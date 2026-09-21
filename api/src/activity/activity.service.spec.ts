import { mockDeep } from 'jest-mock-extended';
import type { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';

describe('ActivityService', () => {
  const prisma = mockDeep<PrismaService>();
  const service = new ActivityService(prisma);

  it('writes redacted entries', async () => {
    await service.record({ action: 'user.create', outcome: 'SUCCESS', after: { username: 'x', passwordHash: 'h' } });
    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'user.create', after: { username: 'x', passwordHash: '[redacted]' } }),
    });
  });

  it('never throws when the database write fails', async () => {
    jest.spyOn((service as unknown as { logger: { error: () => void } }).logger, 'error').mockImplementation(() => undefined);
    prisma.activityLog.create.mockRejectedValueOnce(new Error('db down'));
    await expect(service.record({ action: 'x', outcome: 'FAILURE' })).resolves.toBeUndefined();
  });
});
