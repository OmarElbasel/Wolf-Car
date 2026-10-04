import { NotFoundException } from '@nestjs/common';
import { mock, mockDeep } from 'jest-mock-extended';
import { authUser } from '../../test/unit/helpers';
import type { AuditTrail } from '../activity/audit-trail.service';
import type { PrismaService } from '../prisma/prisma.service';
import { PpfService } from './ppf.service';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'b-1',
  type: 'FULL',
  status: 'BOOKED',
  car: 'Land Cruiser',
  ownerName: 'Khalid',
  phone: null,
  service: null,
  receiveDate: new Date('2026-11-02T00:00:00.000Z'),
  deliveryDate: null,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  cancelledAt: null,
  createdBy: { id: 'u-1', displayName: 'Amani' },
  request: null,
  ...over,
});

const code = (c: string) => ({ response: { code: c } });

describe('PpfService: bookings and days', () => {
  const prisma = mockDeep<PrismaService>();
  const trail = mock<AuditTrail>();
  const service = new PpfService(prisma, trail);
  const amani = authUser({ id: 'u-1', role: 'RESERVATIONS', branchId: null }, ['booking.ppf.read', 'booking.ppf.manage']);
  const dto = { type: 'FULL' as const, car: 'Land Cruiser', ownerName: 'Khalid', receiveDate: '2026-11-02' };

  beforeEach(() => {
    jest.resetAllMocks();
    for (const m of ['setEntity', 'setChange', 'setBranch', 'addMetadata'] as const) trail[m].mockReturnValue(trail);
    prisma.$transaction.mockImplementation((arg: unknown) =>
      (typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[])) as never,
    );
    prisma.ppfClosedDay.findUnique.mockResolvedValue(null);
    prisma.ppfBooking.count.mockResolvedValue(0);
  });

  it('creates a booking on an open day and records it for the audit log', async () => {
    prisma.ppfBooking.create.mockResolvedValue(row() as never);
    const view = await service.create(amani, { ...dto, phone: '55123456', deliveryDate: '2026-11-05' });
    expect(prisma.ppfBooking.create.mock.calls[0][0].data).toMatchObject({
      type: 'FULL',
      phone: '55123456',
      receiveDate: new Date('2026-11-02T00:00:00.000Z'),
      deliveryDate: new Date('2026-11-05T00:00:00.000Z'),
      createdById: 'u-1',
    });
    expect(view.receiveDate).toBe('2026-11-02');
    expect(trail.setEntity).toHaveBeenCalledWith('PpfBooking', 'b-1');
  });

  it('a second full PPF fits in as the exception', async () => {
    prisma.ppfBooking.count.mockResolvedValue(1);
    prisma.ppfBooking.create.mockResolvedValue(row({ id: 'b-2' }) as never);
    await expect(service.create(amani, dto)).resolves.toMatchObject({ id: 'b-2', type: 'FULL' });
    expect(prisma.ppfBooking.count).toHaveBeenCalledWith({
      where: { receiveDate: new Date('2026-11-02T00:00:00.000Z'), type: 'FULL', status: 'BOOKED' },
    });
  });

  it('refuses a third full PPF on the day', async () => {
    prisma.ppfBooking.count.mockResolvedValue(2);
    await expect(service.create(amani, dto)).rejects.toMatchObject(code('PPF_DAY_FULL'));
    expect(prisma.ppfBooking.create).not.toHaveBeenCalled();
  });

  it('light jobs are never counted against the day', async () => {
    prisma.ppfBooking.count.mockResolvedValue(2);
    prisma.ppfBooking.create.mockResolvedValue(row({ type: 'LIGHT' }) as never);
    await expect(service.create(amani, { ...dto, type: 'LIGHT' })).resolves.toMatchObject({ type: 'LIGHT' });
  });

  it('refuses any booking on a day closed by hand, without touching the table', async () => {
    prisma.ppfClosedDay.findUnique.mockResolvedValue({ date: new Date(), reason: null } as never);
    await expect(service.create(amani, { ...dto, type: 'LIGHT' })).rejects.toMatchObject(code('PPF_DAY_CLOSED'));
    expect(prisma.ppfBooking.create).not.toHaveBeenCalled();
  });

  it('refuses a delivery day before the receive day', async () => {
    await expect(service.create(amani, { ...dto, deliveryDate: '2026-11-01' })).rejects.toMatchObject(code('DELIVERY_BEFORE_RECEIVE'));
  });

  it('moving a booking checks the new day, and keeps a delivery day that is still valid', async () => {
    prisma.ppfBooking.findUnique.mockResolvedValue(row({ deliveryDate: new Date('2026-11-10T00:00:00.000Z') }) as never);
    prisma.ppfBooking.updateMany.mockResolvedValue({ count: 1 });
    await service.update(amani, 'b-1', { receiveDate: '2026-11-04' });
    expect(prisma.ppfClosedDay.findUnique).toHaveBeenCalledWith({ where: { date: new Date('2026-11-04T00:00:00.000Z') } });
    expect(prisma.ppfBooking.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'b-1', status: 'BOOKED' },
      data: { receiveDate: new Date('2026-11-04T00:00:00.000Z'), updatedById: 'u-1' },
    });
  });

  it('moving past the delivery day is refused', async () => {
    prisma.ppfBooking.findUnique.mockResolvedValue(row({ deliveryDate: new Date('2026-11-03T00:00:00.000Z') }) as never);
    await expect(service.update(amani, 'b-1', { receiveDate: '2026-11-04' })).rejects.toMatchObject(code('DELIVERY_BEFORE_RECEIVE'));
  });

  it('editing other fields of a booking on a day closed later is still allowed', async () => {
    prisma.ppfBooking.findUnique.mockResolvedValue(row() as never);
    prisma.ppfClosedDay.findUnique.mockResolvedValue({ date: new Date(), reason: null } as never);
    prisma.ppfBooking.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.update(amani, 'b-1', { note: 'bring the spare key' })).resolves.toBeDefined();
  });

  it('moving a full PPF onto a day that already has two is refused; the booking itself is not counted', async () => {
    prisma.ppfBooking.findUnique.mockResolvedValue(row() as never);
    prisma.ppfBooking.count.mockResolvedValue(2);
    await expect(service.update(amani, 'b-1', { receiveDate: '2026-11-04' })).rejects.toMatchObject(code('PPF_DAY_FULL'));
    expect(prisma.ppfBooking.count).toHaveBeenCalledWith({
      where: { receiveDate: new Date('2026-11-04T00:00:00.000Z'), type: 'FULL', status: 'BOOKED', id: { not: 'b-1' } },
    });
    expect(prisma.ppfBooking.updateMany).not.toHaveBeenCalled();
  });

  it('a cancelled booking cannot be edited or cancelled again', async () => {
    prisma.ppfBooking.findUnique.mockResolvedValue(row({ status: 'CANCELLED', cancelledAt: new Date() }) as never);
    prisma.ppfBooking.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.update(amani, 'b-1', { car: 'Patrol' })).rejects.toMatchObject(code('BOOKING_CANCELLED'));
    await expect(service.cancel(amani, 'b-1')).rejects.toMatchObject(code('BOOKING_CANCELLED'));
  });

  it('404s for an unknown booking and an empty update', async () => {
    prisma.ppfBooking.findUnique.mockResolvedValue(null);
    await expect(service.update(amani, 'missing', { car: 'Patrol' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(amani, 'b-1', {})).rejects.toMatchObject(code('NOTHING_TO_UPDATE'));
  });

  it('limits a calendar request to 62 days and a forward range', async () => {
    await expect(service.calendar({ from: '2026-11-01', to: '2027-01-02' })).rejects.toMatchObject(code('BAD_RANGE'));
    await expect(service.calendar({ from: '2026-11-02', to: '2026-11-01' })).rejects.toMatchObject(code('BAD_RANGE'));
  });

  it('builds the calendar from active bookings only, but lists cancelled ones too', async () => {
    prisma.ppfBooking.findMany.mockResolvedValue([row(), row({ id: 'b-2', status: 'CANCELLED', cancelledAt: new Date(), receiveDate: new Date('2026-11-03T00:00:00.000Z') })] as never);
    prisma.ppfClosedDay.findMany.mockResolvedValue([]);
    const cal = await service.calendar({ from: '2026-11-02', to: '2026-11-03' });
    expect(cal.days.map((d) => d.state)).toEqual(['FULL', 'OPEN']);
    expect(cal.bookings).toHaveLength(2);
  });

  it('reopening a day that is not closed is a 404', async () => {
    prisma.ppfClosedDay.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.reopenDay('2026-11-02')).rejects.toBeInstanceOf(NotFoundException);
  });
});
