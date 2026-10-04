import { dayStr } from '../common/day';
import type { Prisma } from '../generated/prisma/client';

export const PPF_BOOKING_SELECT = {
  id: true,
  type: true,
  status: true,
  car: true,
  ownerName: true,
  phone: true,
  service: true,
  receiveDate: true,
  deliveryDate: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  cancelledAt: true,
  createdBy: { select: { id: true, displayName: true } },
  request: { select: { salesName: true } },
} satisfies Prisma.PpfBookingSelect;

type BookingRow = Prisma.PpfBookingGetPayload<{ select: typeof PPF_BOOKING_SELECT }>;

/** What the dashboard sees. Days are "YYYY-MM-DD" strings. */
export function bookingView(b: BookingRow) {
  return {
    id: b.id,
    type: b.type,
    status: b.status,
    car: b.car,
    ownerName: b.ownerName,
    phone: b.phone,
    service: b.service,
    receiveDate: dayStr(b.receiveDate),
    deliveryDate: b.deliveryDate ? dayStr(b.deliveryDate) : null,
    note: b.note,
    /** the salesperson whose approved request created this light job */
    requestedBy: b.request?.salesName ?? null,
    createdBy: b.createdBy,
    createdAt: b.createdAt,
    cancelledAt: b.cancelledAt,
  };
}

export type PpfBookingView = ReturnType<typeof bookingView>;

/** Audit snapshot: the fields a person can change. */
export function bookingAuditView(b: PpfBookingView) {
  const { id: _id, createdBy: _createdBy, createdAt: _createdAt, requestedBy: _requestedBy, ...rest } = b;
  return rest;
}
