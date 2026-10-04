import { NotFoundException } from '@nestjs/common';
import { mock, mockDeep } from 'jest-mock-extended';
import { authUser } from '../../test/unit/helpers';
import type { AuditTrail } from '../activity/audit-trail.service';
import type { PrismaService } from '../prisma/prisma.service';
import { PpfService } from './ppf.service';

const request = (over: Record<string, unknown> = {}) => ({
  id: 'r-1',
  date: new Date('2026-11-02T00:00:00.000Z'),
  type: 'LIGHT',
  salesName: 'Yousef',
  car: 'Lexus LX',
  ownerName: 'Sara',
  phone: null,
  note: 'Front windows tint',
  status: 'PENDING',
  decisionNote: null,
  decidedAt: null,
  bookingId: null,
  createdAt: new Date('2026-11-01T08:00:00.000Z'),
  ...over,
});
const code = (c: string) => ({ response: { code: c } });
// 21:30 UTC on 1 Nov is already 2 Nov in Qatar
const NIGHT = new Date('2026-11-01T21:30:00.000Z');

describe('PpfService: light-job requests', () => {
  const prisma = mockDeep<PrismaService>();
  const trail = mock<AuditTrail>();
  const service = new PpfService(prisma, trail);
  const amani = authUser({ id: 'u-1', role: 'RESERVATIONS', branchId: null }, ['booking.ppf.manage']);
  const dto = { type: 'LIGHT' as const, date: '2026-11-02', salesName: 'Yousef', car: 'Lexus LX', ownerName: 'Sara', note: 'Front windows tint' };

  beforeEach(() => {
    jest.resetAllMocks();
    for (const m of ['setEntity', 'setChange', 'setBranch', 'addMetadata'] as const) trail[m].mockReturnValue(trail);
    prisma.$transaction.mockImplementation((arg: unknown) =>
      (typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[])) as never,
    );
    prisma.ppfClosedDay.findUnique.mockResolvedValue(null);
  });

  describe('createRequest', () => {
    it('accepts a light-job request on an open day and on a booked one', async () => {
      prisma.lightJobRequest.create.mockResolvedValue(request() as never);
      for (const full of [0, 1, 2]) {
        prisma.ppfBooking.count.mockResolvedValue(full);
        await expect(service.createRequest(dto, NIGHT)).resolves.toMatchObject({ status: 'PENDING' });
      }
      expect(prisma.lightJobRequest.create.mock.calls[0][0].data).toMatchObject({ type: 'LIGHT', note: 'Front windows tint' });
    });

    it('accepts a full PPF request for an empty day and for the one exception, not for a third car', async () => {
      const full = { ...dto, type: 'FULL' as const, note: undefined };
      prisma.lightJobRequest.create.mockResolvedValue(request({ type: 'FULL', note: null }) as never);
      prisma.ppfBooking.count.mockResolvedValue(0);
      const view = await service.createRequest(full, NIGHT);
      expect(prisma.ppfBooking.count).toHaveBeenCalledWith({
        where: { receiveDate: new Date('2026-11-02T00:00:00.000Z'), type: 'FULL', status: 'BOOKED' },
      });
      expect(prisma.lightJobRequest.create.mock.calls[0][0].data).toMatchObject({ type: 'FULL', note: null });
      expect(view).toEqual({
        id: 'r-1',
        date: '2026-11-02',
        type: 'FULL',
        salesName: 'Yousef',
        car: 'Lexus LX',
        status: 'PENDING',
        decisionNote: null,
        createdAt: new Date('2026-11-01T08:00:00.000Z'),
      });
      expect(trail.addMetadata).toHaveBeenCalledWith({ salesName: 'Yousef' });

      prisma.ppfBooking.count.mockResolvedValue(1);
      await expect(service.createRequest(full, NIGHT)).resolves.toMatchObject({ type: 'FULL' });
      prisma.ppfBooking.count.mockResolvedValue(2);
      await expect(service.createRequest(full, NIGHT)).rejects.toMatchObject(code('PPF_DAY_FULL'));
    });

    it('refuses a day that is already past in Qatar', async () => {
      await expect(service.createRequest({ ...dto, date: '2026-11-01' }, NIGHT)).rejects.toMatchObject(code('REQUEST_DAY_PAST'));
    });

    it('refuses a day closed by hand', async () => {
      prisma.ppfBooking.count.mockResolvedValue(0);
      prisma.ppfClosedDay.findUnique.mockResolvedValue({ date: new Date(), reason: null } as never);
      await expect(service.createRequest(dto, NIGHT)).rejects.toMatchObject(code('PPF_DAY_CLOSED'));
      expect(prisma.lightJobRequest.create).not.toHaveBeenCalled();
    });
  });

  describe('approve / reject', () => {
    it('approving creates the light job from the request and links it', async () => {
      prisma.lightJobRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.lightJobRequest.findUniqueOrThrow.mockResolvedValue(request({ status: 'APPROVED', phone: '55123456' }) as never);
      prisma.ppfBooking.create.mockResolvedValue({ id: 'b-9' } as never);
      prisma.lightJobRequest.update.mockResolvedValue(request({ status: 'APPROVED', bookingId: 'b-9' }) as never);

      const view = await service.approveRequest(amani, 'r-1', {});
      expect(prisma.lightJobRequest.updateMany.mock.calls[0][0].where).toEqual({ id: 'r-1', status: 'PENDING' });
      expect(prisma.ppfBooking.create.mock.calls[0][0].data).toEqual({
        type: 'LIGHT',
        car: 'Lexus LX',
        ownerName: 'Sara',
        phone: '55123456',
        note: 'Front windows tint',
        receiveDate: new Date('2026-11-02T00:00:00.000Z'),
        createdById: 'u-1',
      });
      expect(view).toMatchObject({ status: 'APPROVED', bookingId: 'b-9' });
    });

    it('approving a full PPF request books the car as a full PPF', async () => {
      prisma.lightJobRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.lightJobRequest.findUniqueOrThrow.mockResolvedValue(request({ status: 'APPROVED', type: 'FULL', note: null }) as never);
      prisma.ppfBooking.count.mockResolvedValue(1);
      prisma.ppfBooking.create.mockResolvedValue({ id: 'b-9' } as never);
      prisma.lightJobRequest.update.mockResolvedValue(request({ status: 'APPROVED', type: 'FULL', bookingId: 'b-9' }) as never);
      await service.approveRequest(amani, 'r-1', {});
      expect(prisma.ppfBooking.create.mock.calls[0][0].data).toMatchObject({ type: 'FULL', note: null });
    });

    it('a full PPF request cannot be approved once the day has two full cars', async () => {
      prisma.lightJobRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.lightJobRequest.findUniqueOrThrow.mockResolvedValue(request({ status: 'APPROVED', type: 'FULL' }) as never);
      prisma.ppfBooking.count.mockResolvedValue(2);
      await expect(service.approveRequest(amani, 'r-1', {})).rejects.toMatchObject(code('PPF_DAY_FULL'));
      expect(prisma.ppfBooking.create).not.toHaveBeenCalled();
    });

    it('a request is decided once', async () => {
      prisma.lightJobRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.lightJobRequest.findUnique.mockResolvedValue(request({ status: 'REJECTED' }) as never);
      await expect(service.approveRequest(amani, 'r-1', {})).rejects.toMatchObject(code('REQUEST_ALREADY_DECIDED'));
      await expect(service.rejectRequest(amani, 'r-1', {})).rejects.toMatchObject(code('REQUEST_ALREADY_DECIDED'));
      expect(prisma.ppfBooking.create).not.toHaveBeenCalled();
    });

    it('an unknown request is a 404', async () => {
      prisma.lightJobRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.lightJobRequest.findUnique.mockResolvedValue(null);
      await expect(service.rejectRequest(amani, 'nope', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('approval fails when the day was closed by hand in the meantime', async () => {
      prisma.lightJobRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.lightJobRequest.findUniqueOrThrow.mockResolvedValue(request({ status: 'APPROVED' }) as never);
      prisma.ppfClosedDay.findUnique.mockResolvedValue({ date: new Date(), reason: null } as never);
      await expect(service.approveRequest(amani, 'r-1', {})).rejects.toMatchObject(code('PPF_DAY_CLOSED'));
      expect(prisma.ppfBooking.create).not.toHaveBeenCalled();
    });

    it('rejecting stores the reason and creates nothing', async () => {
      prisma.lightJobRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.lightJobRequest.findUniqueOrThrow.mockResolvedValue(request({ status: 'REJECTED', decisionNote: 'Workshop is full' }) as never);
      const view = await service.rejectRequest(amani, 'r-1', { decisionNote: 'Workshop is full' });
      expect(prisma.lightJobRequest.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'REJECTED', decisionNote: 'Workshop is full', decidedById: 'u-1' });
      expect(view.decisionNote).toBe('Workshop is full');
      expect(prisma.ppfBooking.create).not.toHaveBeenCalled();
    });
  });

  describe('salesView', () => {
    it('only serves the current month onwards, about a year ahead', async () => {
      await expect(service.salesView({ from: '2026-10-31', to: '2026-11-30' }, NIGHT)).rejects.toMatchObject(code('BAD_RANGE'));
      await expect(service.salesView({ from: '2027-12-10', to: '2027-12-31' }, NIGHT)).rejects.toMatchObject(code('BAD_RANGE'));
    });

    it('returns days, upcoming cars and recent requests without internal fields', async () => {
      prisma.ppfBooking.findMany
        .mockResolvedValueOnce([{ type: 'FULL', receiveDate: new Date('2026-11-02T00:00:00.000Z') }] as never) // days
        .mockResolvedValueOnce([
          { id: 'b-1', type: 'FULL', car: 'Land Cruiser', ownerName: 'Khalid', phone: null, receiveDate: new Date('2026-11-02T00:00:00.000Z'), deliveryDate: null },
        ] as never); // upcoming
      prisma.ppfClosedDay.findMany.mockResolvedValue([]);
      prisma.lightJobRequest.findMany.mockResolvedValue([request()] as never);

      const view = await service.salesView({ from: '2026-11-01', to: '2026-11-30' }, NIGHT);
      expect(view.today).toBe('2026-11-02');
      expect(view.days).toHaveLength(30);
      expect(view.days[1]).toMatchObject({ date: '2026-11-02', state: 'FULL' });
      expect(view.bookings).toEqual([
        { id: 'b-1', type: 'FULL', car: 'Land Cruiser', ownerName: 'Khalid', phone: null, receiveDate: '2026-11-02', deliveryDate: null },
      ]);
      expect(Object.keys(view.requests[0]).sort()).toEqual(['car', 'createdAt', 'date', 'decisionNote', 'id', 'salesName', 'status', 'type']);
    });
  });
});
