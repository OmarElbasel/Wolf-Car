import { NotFoundException } from '@nestjs/common';
import { mock, mockDeep } from 'jest-mock-extended';
import { authUser } from '../../test/unit/helpers';
import type { AuditTrail } from '../activity/audit-trail.service';
import type { PrismaService } from '../prisma/prisma.service';
import { ReservationsService } from './reservations.service';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'g-1',
  date: new Date('2026-11-02T00:00:00.000Z'),
  time: '16:30',
  service: 'Ceramic coating',
  ownerName: null,
  phone: null,
  car: null,
  note: null,
  status: 'BOOKED',
  createdAt: new Date(),
  cancelledAt: null,
  createdBy: { id: 'u-1', displayName: 'Amani' },
  ...over,
});
const code = (c: string) => ({ response: { code: c } });

describe('ReservationsService', () => {
  const prisma = mockDeep<PrismaService>();
  const trail = mock<AuditTrail>();
  const service = new ReservationsService(prisma, trail);
  const amani = authUser({ id: 'u-1', role: 'RESERVATIONS', branchId: null }, ['booking.general.manage']);

  beforeEach(() => {
    jest.resetAllMocks();
    for (const m of ['setEntity', 'setChange', 'addMetadata'] as const) trail[m].mockReturnValue(trail);
  });

  it('creates a reservation with only a day and a service', async () => {
    prisma.generalReservation.create.mockResolvedValue(row({ time: null }) as never);
    const view = await service.create(amani, { date: '2026-11-02', service: 'Ceramic coating' });
    expect(prisma.generalReservation.create.mock.calls[0][0].data).toEqual({
      date: new Date('2026-11-02T00:00:00.000Z'),
      time: null,
      service: 'Ceramic coating',
      ownerName: null,
      phone: null,
      car: null,
      note: null,
      createdById: 'u-1',
    });
    expect(view).toMatchObject({ date: '2026-11-02', time: null, status: 'BOOKED' });
  });

  it('filters by day range, status and a search over owner, phone, car and service', async () => {
    prisma.generalReservation.findMany.mockResolvedValue([]);
    prisma.generalReservation.count.mockResolvedValue(0);
    await service.list({ page: 1, pageSize: 20, from: '2026-11-01', to: '2026-11-30', status: 'BOOKED', q: 'lexus' });
    const where = prisma.generalReservation.findMany.mock.calls[0][0]?.where as { AND: unknown[] };
    expect(where.AND).toContainEqual({ date: { gte: new Date('2026-11-01T00:00:00.000Z') } });
    expect(where.AND).toContainEqual({ date: { lte: new Date('2026-11-30T00:00:00.000Z') } });
    expect(where.AND).toContainEqual({ status: 'BOOKED' });
    const contains = { contains: 'lexus', mode: 'insensitive' };
    expect(where.AND).toContainEqual({ OR: [{ ownerName: contains }, { phone: contains }, { car: contains }, { service: contains }] });
  });

  it('clears the hour with null and leaves other fields alone', async () => {
    prisma.generalReservation.findUnique.mockResolvedValue(row() as never);
    prisma.generalReservation.updateMany.mockResolvedValue({ count: 1 });
    await service.update(amani, 'g-1', { time: null });
    expect(prisma.generalReservation.updateMany.mock.calls[0][0]).toEqual({
      where: { id: 'g-1', status: 'BOOKED' },
      data: { time: null, updatedById: 'u-1' },
    });
  });

  it('a cancelled reservation cannot be changed or cancelled again', async () => {
    prisma.generalReservation.findUnique.mockResolvedValue(row({ status: 'CANCELLED', cancelledAt: new Date() }) as never);
    prisma.generalReservation.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.update(amani, 'g-1', { service: 'Polish' })).rejects.toMatchObject(code('BOOKING_CANCELLED'));
    await expect(service.cancel(amani, 'g-1')).rejects.toMatchObject(code('BOOKING_CANCELLED'));
  });

  it('404s for an unknown id and refuses an empty update', async () => {
    prisma.generalReservation.findUnique.mockResolvedValue(null);
    await expect(service.cancel(amani, 'nope')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(amani, 'g-1', {})).rejects.toMatchObject(code('NOTHING_TO_UPDATE'));
  });
});
