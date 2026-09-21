import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '../../generated/prisma/client';
import { AccountLockedException } from '../errors';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn(), headersSent: false };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ id: 'rid', originalUrl: '/x' }) }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter();
  jest.spyOn((filter as unknown as { logger: { error: () => void } }).logger, 'error').mockImplementation(() => undefined);
  filter.catch(exception, host);
  return { status: res.status.mock.calls[0][0] as number, body: res.json.mock.calls[0][0], res };
}

describe('AllExceptionsFilter', () => {
  it('passes HttpExceptions through with the request id', () => {
    const { status, body } = run(new NotFoundException('Order not found.'));
    expect(status).toBe(404);
    expect(body).toMatchObject({ statusCode: 404, message: 'Order not found.', requestId: 'rid' });
  });

  it('keeps structured validation errors', () => {
    const { body } = run(new BadRequestException({ message: 'Some fields are not valid.', errors: [{ field: 'price' }] }));
    expect(body.errors).toEqual([{ field: 'price' }]);
  });

  it('never leaks internals of unknown errors', () => {
    const { status, body } = run(new Error('connect ECONNREFUSED 10.0.0.1:5432 password=hunter2'));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|hunter2|stack/);
  });

  it('maps unique violations to 409 with a friendly message', () => {
    const err = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'x',
      meta: { target: ['barcode'] },
    });
    const { status, body } = run(err);
    expect(status).toBe(409);
    expect(body.message).toBe('Another product already uses this barcode.');
  });

  it('maps the branch staffing constraint to 409', () => {
    const { status, body } = run({ message: 'branch x must have exactly one manager', cause: { message: 'branch_staffing' } });
    expect(status).toBe(409);
    expect(body.message).toContain('exactly one branch manager');
  });

  it('adds Retry-After for lockouts and handles throttling', () => {
    const locked = run(new AccountLockedException(900));
    expect(locked.status).toBe(423);
    expect(locked.res.setHeader).toHaveBeenCalledWith('Retry-After', '900');
    expect(run(new ThrottlerException()).status).toBe(429);
  });

  it('maps multer size errors to 413', () => {
    expect(run({ name: 'MulterError', code: 'LIMIT_FILE_SIZE' }).status).toBe(413);
  });
});
