import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CALENDAR_MAX_DAYS } from '../../../shared/validation';
import { AuditTrail } from '../activity/audit-trail.service';
import { dayStr, daysBetween, qatarToday, toDate } from '../common/day';
import { type Page, skipTake } from '../common/pagination';
import type { AuthUser } from '../common/types';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type DayInfo, dayStates } from './day-state';
import type { CloseDayDto, CreatePpfBookingDto, ListPpfBookingsQueryDto, UpdatePpfBookingDto } from './dto/ppf.dto';
import { bookingAuditView, bookingView, PPF_BOOKING_SELECT, type PpfBookingView } from './ppf.view';

export const conflict = (code: string, message: string) => new ConflictException({ statusCode: 409, error: 'Conflict', code, message });
export const bad = (code: string, message: string) => new BadRequestException({ statusCode: 400, error: 'Bad Request', code, message });

/** ppf_bookings has one unique index besides its primary key: one active full PPF per day. */
const isDayTaken = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
const dayFull = () => conflict('PPF_DAY_FULL', 'A full PPF is already booked on this day.');

type Db = Pick<Prisma.TransactionClient, 'ppfClosedDay'>;

/**
 * PPF and tinting bookings for Bin Omran. A FULL booking closes its receive
 * day (one per day, enforced by the database); LIGHT jobs never do. The call
 * center can also close a day by hand, which blocks new bookings of both kinds.
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
    try {
      const row = await this.prisma.ppfBooking.create({
        data: {
          type: dto.type,
          car: dto.car,
          ownerName: dto.ownerName,
          phone: dto.phone ?? null,
          service: dto.service ?? null,
          receiveDate: toDate(dto.receiveDate),
          deliveryDate: dto.deliveryDate ? toDate(dto.deliveryDate) : null,
          note: dto.note ?? null,
          createdById: user.id,
        },
        select: PPF_BOOKING_SELECT,
      });
      const view = bookingView(row);
      this.trail.setEntity('PpfBooking', view.id).setChange(null, bookingAuditView(view));
      return view;
    } catch (err) {
      if (isDayTaken(err)) throw dayFull();
      throw err;
    }
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

    try {
      const result = await this.prisma.ppfBooking.updateMany({
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
    } catch (err) {
      if (isDayTaken(err)) throw dayFull();
      throw err;
    }
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

  private async get(id: string): Promise<PpfBookingView> {
    const row = await this.prisma.ppfBooking.findUnique({ where: { id }, select: PPF_BOOKING_SELECT });
    if (!row) throw new NotFoundException('Booking not found.');
    return bookingView(row);
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
