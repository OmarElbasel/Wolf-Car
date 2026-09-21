import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { checkPasswordRules } from '../../../shared/validation';
import { IsPrice, IsStrongPassword, ToPriceString } from './validators';

class PasswordBody {
  @IsStrongPassword()
  password: string;
}

class PriceBody {
  @ToPriceString()
  @IsPrice()
  price: unknown;
}

const errorsFor = <T extends object>(cls: new () => T, body: object) =>
  validateSync(plainToInstance(cls, body)).flatMap((e) => Object.values(e.constraints ?? {}));

describe('shared password rules', () => {
  it('reports each rule separately', () => {
    const failed = checkPasswordRules('short').filter((r) => !r.ok).map((r) => r.rule);
    expect(failed).toEqual(expect.arrayContaining(['length', 'upper', 'number', 'symbol']));
    expect(checkPasswordRules('Str0ng#Password!').every((r) => r.ok)).toBe(true);
  });

  it('rejects passwords equal to or containing the username (case-insensitive)', () => {
    const rule = (pw: string, user: string) => checkPasswordRules(pw, user).find((r) => r.rule === 'notUsername')?.ok;
    expect(rule('Gh.Cashier#2026x', 'gh.cashier')).toBe(false);
    expect(rule('Totally#Different9', 'gh.cashier')).toBe(true);
  });

  it('accepts Arabic letters as long as upper/lower Latin letters are present', () => {
    expect(checkPasswordRules('كلمةسرAa1!xyzw').every((r) => r.ok)).toBe(true);
  });
});

describe('IsStrongPassword', () => {
  it('passes a strong password and lists what is missing otherwise', () => {
    expect(errorsFor(PasswordBody, { password: 'Str0ng#Password!' })).toEqual([]);
    const [message] = errorsFor(PasswordBody, { password: 'weakpassword' });
    expect(message).toContain('uppercase');
    expect(message).toContain('symbol');
    expect(errorsFor(PasswordBody, { password: 12345 })).toHaveLength(1);
  });
});

describe('IsPrice', () => {
  it.each([['125'], ['125.5'], ['125.50'], [0], [9999999.99], ['0.99']])('accepts %p', (price) => {
    expect(errorsFor(PriceBody, { price })).toEqual([]);
  });

  it.each([['-1'], ['1.234'], ['abc'], ['10000000'], ['01.5'], [null], [''], ['1e3']])('rejects %p', (price) => {
    expect(errorsFor(PriceBody, { price })).toHaveLength(1);
  });
});
