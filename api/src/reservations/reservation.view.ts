import { dayStr } from '../common/day';
import type { Prisma } from '../generated/prisma/client';

export const RESERVATION_SELECT = {
  id: true,
  date: true,
  time: true,
  service: true,
  ownerName: true,
  phone: true,
  car: true,
  note: true,
  status: true,
  createdAt: true,
  cancelledAt: true,
  createdBy: { select: { id: true, displayName: true } },
} satisfies Prisma.GeneralReservationSelect;

type Row = Prisma.GeneralReservationGetPayload<{ select: typeof RESERVATION_SELECT }>;

export function reservationView(r: Row) {
  return { ...r, date: dayStr(r.date) };
}
export type ReservationView = ReturnType<typeof reservationView>;

export function reservationAuditView(r: ReservationView) {
  const { id: _id, createdBy: _createdBy, createdAt: _createdAt, ...rest } = r;
  return rest;
}
