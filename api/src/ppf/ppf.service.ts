import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CALENDAR_MAX_DAYS, PPF_MAX_FULL_PER_DAY } from '../../../shared/validation';
import { AuditTrail } from '../activity/audit-trail.service';
import { addDays, dayStr, daysBetween, qatarToday, toDate } from '../common/day';
import { type Page, skipTake } from '../common/pagination';
import type { AuthUser } from '../common/types';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type DayInfo, dayStates } from './day-state';
import type {
  CloseDayDto,
  CreatePpfBookingDto,
  CreatePpfRequestDto,
  DecideRequestDto,
  ListPpfBookingsQueryDto,
  ListRequestsQueryDto,
  UpdatePpfBookingDto,
} from './dto/ppf.dto';
import {
  bookingAuditView,
  bookingView,
  type LightJobRequestView,
  PPF_BOOKING_SELECT,
  type PpfBookingView,
  REQUEST_SELECT,
  requestView,
  SALES_BOOKING_SELECT,
  type SalesBookingView,
  salesBookingView,
  type SalesRequestView,
  salesRequestView,
} from './ppf.view';

export const conflict = (code: string, message: string) => new ConflictException({ statusCode: 409, error: 'Conflict', code, message });
export const bad = (code: string, message: string) => new BadRequestException({ statusCode: 400, error: 'Bad Request', code, message });

const dayFull = () => conflict('PPF_DAY_FULL', `This day already has ${PPF_MAX_FULL_PER_DAY} full PPF cars.`);
const alreadyDecided = () => conflict('REQUEST_ALREADY_DECIDED', 'This request has already been answered.');
/** How far ahead the sales page may look, and how long a request stays listed. */
const SALES_HORIZON_DAYS = 400;
const REQUEST_LISTED_MS = 14 * 86_400_000;

type Db = Pick<Prisma.TransactionClient, 'ppfClosedDay'>;
type Tx = Prisma.TransactionClient;

/**
 * PPF and tinting bookings for Bin Omran. A FULL booking closes its receive
 * day; one more FULL may be added as an exception, never a third. LIGHT jobs
 * are not limited. The call center can also close a day by hand, which blocks
 * new bookings of both kinds.
 */
@Injectable()
export class PpfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trail: AuditTrail,
  ) {}

  async calendar(q: { from: string; to: string }): Promise<{ today: string; days: DayInfo[]; bookings: PpfBookingView[] }> {
    this.assertRange(q.from, q.to);
    const between = { gte: toDate(q.from), lte: toDate(q.to) };
    const [rows, closed] = await Promise.all([
      this.prisma.ppfBooking.findMany({
        where: { receiveDate: between },
        select: PPF_BOOKING_SELECT,
        orderBy: [{ receiveDate: 'asc' }, { type: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.ppfClosedDay.findMany({ where: { date: between }, select: { date: true, reason: true } }),
    ]);
    const bookings = rows.map(bookingView);
    return {
      today: qatarToday(),
      days: dayStates(
        q.from,
        q.to,
        bookings.filter((b) => b.status === 'BOOKED'),
        closed.map((c) => ({ date: dayStr(c.date), reason: c.reason })),
      ),
      bookings,
    };
  }

  async list(q: ListPpfBookingsQueryDto): Promise<Page<PpfBookingView>> {
    const and: Prisma.PpfBookingWhereInput[] = [];
    if (q.from) and.push({ receiveDate: { gte: toDate(q.from) } });
    if (q.to) and.push({ receiveDate: { lte: toDate(q.to) } });
    if (q.status) and.push({ status: q.status });
    if (q.q) {
      const contains = { contains: q.q, mode: 'insensitive' as const };
      and.push({ OR: [{ car: contains }, { ownerName: contains }, { phone: contains }, { service: contains }] });
    }
    const where: Prisma.PpfBookingWhereInput = { AND: and };
    const [rows, total] = await Promise.all([
      this.prisma.ppfBooking.findMany({ where, select: PPF_BOOKING_SELECT, orderBy: [{ receiveDate: 'asc' }, { type: 'asc' }, { createdAt: 'asc' }], ...skipTake(q) }),
      this.prisma.ppfBooking.count({ where }),
    ]);
    return { items: rows.map(bookingView), page: q.page, pageSize: q.pageSize, total };
  }

  async create(user: AuthUser, dto: CreatePpfBookingDto): Promise<PpfBookingView> {
    this.assertDelivery(dto.receiveDate, dto.deliveryDate ?? null);
    await this.assertNotClosed(dto.receiveDate);
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.type === 'FULL') await this.claimFullSlot(tx, dto.receiveDate);
      return tx.ppfBooking.create({
        data: {
          type: dto.type,
          car: dto.car,
          ownerName: dto.ownerName ?? null,
          phone: dto.phone ?? null,
          service: dto.service ?? null,
          receiveDate: toDate(dto.receiveDate),
          deliveryDate: dto.deliveryDate ? toDate(dto.deliveryDate) : null,
          note: dto.note ?? null,
          createdById: user.id,
        },
        select: PPF_BOOKING_SELECT,
      });
    });
    const view = bookingView(row);
    this.trail.setEntity('PpfBooking', view.id).setChange(null, bookingAuditView(view));
    return view;
  }

  async update(user: AuthUser, id: string, dto: UpdatePpfBookingDto): Promise<PpfBookingView> {
    if (Object.values(dto).every((v) => v === undefined)) throw bad('NOTHING_TO_UPDATE', 'Nothing to update.');
    const before = await this.get(id);
    if (before.status === 'CANCELLED') throw conflict('BOOKING_CANCELLED', 'A cancelled booking cannot be changed.');

    const receiveDate = dto.receiveDate ?? before.receiveDate;
    const deliveryDate = dto.deliveryDate !== undefined ? dto.deliveryDate : before.deliveryDate;
    this.assertDelivery(receiveDate, deliveryDate);
    // a day closed after the booking was made does not freeze the booking; only moving onto one is refused
    if (receiveDate !== before.receiveDate) await this.assertNotClosed(receiveDate);

    const type = dto.type ?? before.type;
    // a full PPF arriving on a day (moved there, or turned from a light job) needs one of its two places
    const arrives = type === 'FULL' && (before.type !== 'FULL' || receiveDate !== before.receiveDate);

    await this.prisma.$transaction(async (tx) => {
      if (arrives) await this.claimFullSlot(tx, receiveDate, id);
      const result = await tx.ppfBooking.updateMany({
        where: { id, status: 'BOOKED' },
        data: {
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.car !== undefined ? { car: dto.car } : {}),
          ...(dto.ownerName !== undefined ? { ownerName: dto.ownerName } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.service !== undefined ? { service: dto.service } : {}),
          ...(dto.receiveDate !== undefined ? { receiveDate: toDate(dto.receiveDate) } : {}),
          ...(dto.deliveryDate !== undefined ? { deliveryDate: dto.deliveryDate ? toDate(dto.deliveryDate) : null } : {}),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
          updatedById: user.id,
        },
      });
      if (result.count === 0) throw conflict('BOOKING_CANCELLED', 'A cancelled booking cannot be changed.');
    });
    const after = await this.get(id);
    this.trail.setEntity('PpfBooking', id).setChange(bookingAuditView(before), bookingAuditView(after));
    return after;
  }

  /** One conditional UPDATE, so two people cancelling at once cannot both succeed. */
  async cancel(user: AuthUser, id: string): Promise<PpfBookingView> {
    const before = await this.get(id);
    const result = await this.prisma.ppfBooking.updateMany({
      where: { id, status: 'BOOKED' },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: user.id },
    });
    if (result.count === 0) throw conflict('BOOKING_CANCELLED', 'This booking is already cancelled.');
    const after = await this.get(id);
    this.trail.setEntity('PpfBooking', id).setChange(bookingAuditView(before), bookingAuditView(after));
    return after;
  }

  async closeDay(user: AuthUser, date: string, dto: CloseDayDto): Promise<{ date: string; reason: string | null }> {
    const reason = dto.reason ?? null;
    await this.prisma.ppfClosedDay.upsert({
      where: { date: toDate(date) },
      create: { date: toDate(date), reason, createdById: user.id },
      update: { reason },
    });
    this.trail.setEntity('PpfClosedDay', date).setChange(null, { date, reason });
    return { date, reason };
  }

  async reopenDay(date: string): Promise<void> {
    const result = await this.prisma.ppfClosedDay.deleteMany({ where: { date: toDate(date) } });
    if (result.count === 0) throw new NotFoundException('This day is not closed.');
    this.trail.setEntity('PpfClosedDay', date).setChange({ date }, null);
  }

  async listRequests(q: ListRequestsQueryDto): Promise<Page<LightJobRequestView>> {
    const where: Prisma.LightJobRequestWhereInput = q.status ? { status: q.status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.lightJobRequest.findMany({ where, select: REQUEST_SELECT, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.lightJobRequest.count({ where }),
    ]);
    return { items: rows.map(requestView), page: q.page, pageSize: q.pageSize, total };
  }

  /**
   * Claims the request (PENDING → APPROVED) and adds the booking it asked for
   * in one transaction: a second approval, or an approval racing a rejection,
   * finds nothing to claim. A day closed by hand since then, or a full PPF
   * request for a day that has filled up, rolls everything back.
   */
  async approveRequest(user: AuthUser, id: string, dto: DecideRequestDto): Promise<LightJobRequestView> {
    const view = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.lightJobRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVED', decidedById: user.id, decidedAt: new Date(), decisionNote: dto.decisionNote ?? null },
      });
      if (claimed.count === 0) await this.throwDecided(id, tx);
      const request = await tx.lightJobRequest.findUniqueOrThrow({ where: { id }, select: REQUEST_SELECT });
      await this.assertNotClosed(dayStr(request.date), tx);
      if (request.type === 'FULL') await this.claimFullSlot(tx, dayStr(request.date));
      const booking = await tx.ppfBooking.create({
        data: {
          type: request.type,
          car: request.car,
          ownerName: request.ownerName,
          phone: request.phone,
          note: request.note,
          receiveDate: request.date,
          createdById: user.id,
        },
        select: { id: true },
      });
      return requestView(await tx.lightJobRequest.update({ where: { id }, data: { bookingId: booking.id }, select: REQUEST_SELECT }));
    });
    this.trail.setEntity('LightJobRequest', id).setChange({ status: 'PENDING' }, { status: 'APPROVED', bookingId: view.bookingId });
    return view;
  }

  async rejectRequest(user: AuthUser, id: string, dto: DecideRequestDto): Promise<LightJobRequestView> {
    const decisionNote = dto.decisionNote ?? null;
    const claimed = await this.prisma.lightJobRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', decidedById: user.id, decidedAt: new Date(), decisionNote },
    });
    if (claimed.count === 0) await this.throwDecided(id, this.prisma);
    this.trail.setEntity('LightJobRequest', id).setChange({ status: 'PENDING' }, { status: 'REJECTED', decisionNote });
    return requestView(await this.prisma.lightJobRequest.findUniqueOrThrow({ where: { id }, select: REQUEST_SELECT }));
  }

  /**
   * A salesperson asks the call center for a booking; nothing is reserved until
   * it is approved. Only for today or later (Qatar), never on a day closed by
   * hand. A full PPF may be asked for while the day has room for one (an empty
   * day, or the exception on a booked day); light jobs may always be asked for.
   */
  async createRequest(dto: CreatePpfRequestDto, now: Date = new Date()): Promise<SalesRequestView> {
    if (dto.date < qatarToday(now)) throw bad('REQUEST_DAY_PAST', 'This day has already passed.');
    const type = dto.type ?? 'LIGHT';
    const date = toDate(dto.date);
    await this.assertNotClosed(dto.date);
    if (type === 'FULL') await this.assertFullRoom(this.prisma, dto.date);
    const row = await this.prisma.lightJobRequest.create({
      data: { date, type, salesName: dto.salesName, car: dto.car, ownerName: dto.ownerName, phone: dto.phone ?? null, note: dto.note ?? null },
      select: REQUEST_SELECT,
    });
    // sales have no account: the typed name is the only "who"
    this.trail.setEntity('LightJobRequest', row.id).addMetadata({ salesName: dto.salesName });
    return salesRequestView(row);
  }

  /** Everything the sales page shows, and nothing else. */
  async salesView(
    q: { from: string; to: string },
    now: Date = new Date(),
  ): Promise<{ today: string; days: DayInfo[]; bookings: SalesBookingView[]; requests: SalesRequestView[] }> {
    const today = qatarToday(now);
    this.assertRange(q.from, q.to);
    if (q.from < `${today.slice(0, 7)}-01` || q.to > addDays(today, SALES_HORIZON_DAYS)) {
      throw bad('BAD_RANGE', 'The slots page shows the current month and about a year ahead.');
    }
    const between = { gte: toDate(q.from), lte: toDate(q.to) };
    const from = toDate(today);
    const [inRange, upcoming, closed, requests] = await Promise.all([
      this.prisma.ppfBooking.findMany({ where: { status: 'BOOKED', receiveDate: between }, select: { type: true, receiveDate: true } }),
      this.prisma.ppfBooking.findMany({
        where: { status: 'BOOKED', OR: [{ receiveDate: { gte: from } }, { deliveryDate: { gte: from } }] },
        select: SALES_BOOKING_SELECT,
        orderBy: [{ receiveDate: 'asc' }, { type: 'asc' }, { createdAt: 'asc' }],
        take: 200,
      }),
      this.prisma.ppfClosedDay.findMany({ where: { date: between }, select: { date: true, reason: true } }),
      this.prisma.lightJobRequest.findMany({
        where: { OR: [{ createdAt: { gte: new Date(now.getTime() - REQUEST_LISTED_MS) } }, { date: { gte: from } }] },
        select: REQUEST_SELECT,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return {
      today,
      days: dayStates(
        q.from,
        q.to,
        inRange.map((b) => ({ type: b.type, receiveDate: dayStr(b.receiveDate) })),
        closed.map((c) => ({ date: dayStr(c.date), reason: c.reason })),
      ),
      bookings: upcoming.map(salesBookingView),
      requests: requests.map(salesRequestView),
    };
  }

  private async throwDecided(id: string, db: Pick<Prisma.TransactionClient, 'lightJobRequest'>): Promise<never> {
    const exists = await db.lightJobRequest.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Request not found.');
    throw alreadyDecided();
  }

  private async get(id: string): Promise<PpfBookingView> {
    const row = await this.prisma.ppfBooking.findUnique({ where: { id }, select: PPF_BOOKING_SELECT });
    if (!row) throw new NotFoundException('Booking not found.');
    return bookingView(row);
  }

  /**
   * Takes the day's lock until the transaction ends, then checks there is room
   * for one more full PPF. Everything that puts a full PPF on a day goes
   * through here, so two people cannot both take the last place.
   */
  private async claimFullSlot(tx: Tx, date: string, exceptId?: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ppf-day:${date}`}))`;
    await this.assertFullRoom(tx, date, exceptId);
  }

  private async assertFullRoom(db: Pick<Tx, 'ppfBooking'>, date: string, exceptId?: string): Promise<void> {
    const full = await db.ppfBooking.count({
      where: { receiveDate: toDate(date), type: 'FULL', status: 'BOOKED', ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
    if (full >= PPF_MAX_FULL_PER_DAY) throw dayFull();
  }

  protected assertRange(from: string, to: string): void {
    const span = daysBetween(from, to);
    if (span < 0 || span >= CALENDAR_MAX_DAYS) {
      throw bad('BAD_RANGE', `Choose a range of 1 to ${CALENDAR_MAX_DAYS} days, with "from" on or before "to".`);
    }
  }

  private assertDelivery(receiveDate: string, deliveryDate: string | null): void {
    if (deliveryDate && deliveryDate < receiveDate) {
      throw bad('DELIVERY_BEFORE_RECEIVE', 'The delivery day cannot be before the receive day.');
    }
  }

  protected async assertNotClosed(date: string, db: Db = this.prisma): Promise<void> {
    if (await db.ppfClosedDay.findUnique({ where: { date: toDate(date) } })) {
      throw conflict('PPF_DAY_CLOSED', 'This day is closed. Reopen it first.');
    }
  }
}
