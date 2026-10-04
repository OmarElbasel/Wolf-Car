import { BadRequestException } from '@nestjs/common';
import { validateSync } from 'class-validator';
import { addDays, dayStr, daysBetween, eachDay, IsDay, isDay, ParseDayPipe, qatarToday, toDate } from './day';

class Probe {
  @IsDay()
  day: unknown;
}
const errorsFor = (day: unknown) => validateSync(Object.assign(new Probe(), { day })).length;

describe('Qatar day helpers', () => {
  it('round-trips a day through a UTC-midnight Date', () => {
    expect(toDate('2026-11-02').toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(dayStr(toDate('2026-11-02'))).toBe('2026-11-02');
  });

  it('accepts only real calendar days', () => {
    expect(isDay('2026-02-28')).toBe(true);
    expect(isDay('2028-02-29')).toBe(true); // leap year
    expect(isDay('2026-02-29')).toBe(false);
    expect(isDay('2026-02-30')).toBe(false);
    expect(isDay('2026-13-01')).toBe(false);
    expect(isDay('2026-1-5')).toBe(false);
    expect(isDay('2026-11-02T00:00:00Z')).toBe(false);
    expect(isDay(20261102)).toBe(false);
    expect(isDay(null)).toBe(false);
  });

  it('@IsDay rejects impossible days', () => {
    expect(errorsFor('2026-11-02')).toBe(0);
    expect(errorsFor('2026-02-30')).toBe(1);
    expect(errorsFor(undefined)).toBe(1);
  });

  it('ParseDayPipe turns a bad route parameter into a 400', () => {
    const pipe = new ParseDayPipe();
    expect(pipe.transform('2026-11-02')).toBe('2026-11-02');
    expect(() => pipe.transform('2026-02-30')).toThrow(BadRequestException);
  });

  it('"today" follows Qatar time, three hours ahead of UTC', () => {
    expect(qatarToday(new Date('2026-11-01T20:59:59.000Z'))).toBe('2026-11-01');
    expect(qatarToday(new Date('2026-11-01T21:00:00.000Z'))).toBe('2026-11-02');
    expect(qatarToday(new Date('2026-12-31T21:30:00.000Z'))).toBe('2027-01-01');
  });

  it('does day arithmetic across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-01', '2026-11-01')).toBe(0);
    expect(daysBetween('2026-11-01', '2026-12-01')).toBe(30);
    expect(daysBetween('2026-11-02', '2026-11-01')).toBe(-1);
    expect(eachDay('2026-02-27', '2026-03-01')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(eachDay('2026-03-02', '2026-03-01')).toEqual([]);
  });
});
