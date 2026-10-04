import { dayStates } from './day-state';

describe('dayStates', () => {
  const full = (receiveDate: string) => ({ type: 'FULL' as const, receiveDate });
  const light = (receiveDate: string) => ({ type: 'LIGHT' as const, receiveDate });

  it('lists every day of the range, open by default', () => {
    expect(dayStates('2026-11-01', '2026-11-03', [], [])).toEqual([
      { date: '2026-11-01', state: 'OPEN', reason: null, lightCount: 0 },
      { date: '2026-11-02', state: 'OPEN', reason: null, lightCount: 0 },
      { date: '2026-11-03', state: 'OPEN', reason: null, lightCount: 0 },
    ]);
  });

  it('a full PPF closes its day; light jobs only count', () => {
    const days = dayStates('2026-11-01', '2026-11-02', [full('2026-11-01'), light('2026-11-01'), light('2026-11-02'), light('2026-11-02')], []);
    expect(days).toEqual([
      { date: '2026-11-01', state: 'FULL', reason: null, lightCount: 1 },
      { date: '2026-11-02', state: 'OPEN', reason: null, lightCount: 2 },
    ]);
  });

  it('a day closed by hand wins over a full PPF and carries its reason', () => {
    const [day] = dayStates('2026-11-01', '2026-11-01', [full('2026-11-01')], [{ date: '2026-11-01', reason: 'National Day' }]);
    expect(day).toEqual({ date: '2026-11-01', state: 'CLOSED', reason: 'National Day', lightCount: 0 });
  });

  it('ignores bookings and closed days outside the range', () => {
    const days = dayStates('2026-11-02', '2026-11-02', [full('2026-11-01')], [{ date: '2026-11-03', reason: null }]);
    expect(days).toEqual([{ date: '2026-11-02', state: 'OPEN', reason: null, lightCount: 0 }]);
  });
});
