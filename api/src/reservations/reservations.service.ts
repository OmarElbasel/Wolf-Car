import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditTrail } from '../activity/audit-trail.service';
import { toDate } from '../common/day';
import { type Page, skipTake } from '../common/pagination';
import type { AuthUser } from '../common/types';
import type { Prisma } from '../generated/prisma/client';
import { bad, conflict } from '../ppf/ppf.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateReservationDto, ListReservationsQueryDto, UpdateReservationDto } from './dto/reservations.dto';
import { RESERVATION_SELECT, reservationAuditView, reservationView, type ReservationView } from './reservation.view';

const cancelled = () => conflict('BOOKING_CANCELLED', 'A cancelled reservation cannot be changed.');

/**
 * The call center's private list of every reservation that is not a PPF
 * booking. No slots and no limits: a day, optionally an hour, and what it is for.
 */
@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trail: AuditTrail,
  ) {}

  async list(q: ListReservationsQueryDto): Promise<Page<ReservationView>> {
    const and: Prisma.GeneralReservationWhereInput[] = [];
    if (q.from) and.push({ date: { gte: toDate(q.from) } });
    if (q.to) and.push({ date: { lte: toDate(q.to) } });
    if (q.status) and.push({ status: q.status });
    if (q.q) {
      const contains = { contains: q.q, mode: 'insensitive' as const };
      and.push({ OR: [{ ownerName: contains }, { phone: contains }, { car: contains }, { service: contains }] });
    }
    const where: Prisma.GeneralReservationWhereInput = { AND: and };
    const [rows, total] = await Promise.all([
      this.prisma.generalReservation.findMany({
        where,
        select: RESERVATION_SELECT,
        // reservations without an hour lead their day
        orderBy: [{ date: 'asc' }, { time: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
        ...skipTake(q),
      }),
      this.prisma.generalReservation.count({ where }),
    ]);
    return { items: rows.map(reservationView), page: q.page, pageSize: q.pageSize, total };
  }

  async create(user: AuthUser, dto: CreateReservationDto): Promise<ReservationView> {
    const row = await this.prisma.generalReservation.create({
      data: {
        date: toDate(dto.date),
        time: dto.time ?? null,
        service: dto.service,
        ownerName: dto.ownerName ?? null,
        phone: dto.phone ?? null,
        car: dto.car ?? null,
        note: dto.note ?? null,
        createdById: user.id,
      },
      select: RESERVATION_SELECT,
    });
    const view = reservationView(row);
    this.trail.setEntity('GeneralReservation', view.id).setChange(null, reservationAuditView(view));
    return view;
  }

  async update(user: AuthUser, id: string, dto: UpdateReservationDto): Promise<ReservationView> {
    if (Object.values(dto).every((v) => v === undefined)) throw bad('NOTHING_TO_UPDATE', 'Nothing to update.');
    const before = await this.get(id);
    if (before.status === 'CANCELLED') throw cancelled();
    const result = await this.prisma.generalReservation.updateMany({
      where: { id, status: 'BOOKED' },
      data: {
        ...(dto.date !== undefined ? { date: toDate(dto.date) } : {}),
        ...(dto.time !== undefined ? { time: dto.time } : {}),
        ...(dto.service !== undefined ? { service: dto.service } : {}),
        ...(dto.ownerName !== undefined ? { ownerName: dto.ownerName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.car !== undefined ? { car: dto.car } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        updatedById: user.id,
      },
    });
    if (result.count === 0) throw cancelled();
    const after = await this.get(id);
    this.trail.setEntity('GeneralReservation', id).setChange(reservationAuditView(before), reservationAuditView(after));
    return after;
  }

  async cancel(user: AuthUser, id: string): Promise<ReservationView> {
    const before = await this.get(id);
    const result = await this.prisma.generalReservation.updateMany({
      where: { id, status: 'BOOKED' },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: user.id },
    });
    if (result.count === 0) throw conflict('BOOKING_CANCELLED', 'This reservation is already cancelled.');
    const after = await this.get(id);
    this.trail.setEntity('GeneralReservation', id).setChange(reservationAuditView(before), reservationAuditView(after));
    return after;
  }

  private async get(id: string): Promise<ReservationView> {
    const row = await this.prisma.generalReservation.findUnique({ where: { id }, select: RESERVATION_SELECT });
    if (!row) throw new NotFoundException('Reservation not found.');
    return reservationView(row);
  }
}
