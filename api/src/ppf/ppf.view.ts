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
export const REQUEST_SELECT = {
  id: true,
  date: true,
  salesName: true,
  car: true,
  ownerName: true,
  phone: true,
  note: true,
  status: true,
  decisionNote: true,
  decidedAt: true,
  bookingId: true,
  createdAt: true,
} satisfies Prisma.LightJobRequestSelect;

type RequestRow = Prisma.LightJobRequestGetPayload<{ select: typeof REQUEST_SELECT }>;

/** What the call center sees. */
export function requestView(r: RequestRow) {
  return { ...r, date: dayStr(r.date) };
}
export type LightJobRequestView = ReturnType<typeof requestView>;

/** What the sales page sees: no customer details beyond the car, no note. */
export function salesRequestView(r: Pick<RequestRow, 'id' | 'date' | 'salesName' | 'car' | 'status' | 'decisionNote' | 'createdAt'>) {
  return { id: r.id, date: dayStr(r.date), salesName: r.salesName, car: r.car, status: r.status, decisionNote: r.decisionNote, createdAt: r.createdAt };
}
export type SalesRequestView = ReturnType<typeof salesRequestView>;

export const SALES_BOOKING_SELECT = {
  id: true,
  type: true,
  car: true,
  ownerName: true,
  phone: true,
  receiveDate: true,
  deliveryDate: true,
} satisfies Prisma.PpfBookingSelect;

type SalesBookingRow = Prisma.PpfBookingGetPayload<{ select: typeof SALES_BOOKING_SELECT }>;

/** The sales page's list of booked cars: exactly the fields the spec names. */
export function salesBookingView(b: SalesBookingRow) {
  return {
    id: b.id,
    type: b.type,
    car: b.car,
    ownerName: b.ownerName,
    phone: b.phone,
    receiveDate: dayStr(b.receiveDate),
    deliveryDate: b.deliveryDate ? dayStr(b.deliveryDate) : null,
  };
}
export type SalesBookingView = ReturnType<typeof salesBookingView>;
