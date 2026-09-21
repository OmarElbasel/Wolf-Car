import { isStrongPassword } from '../../../shared/validation';
import { RECOVERY_CODE_PATTERN } from '../../../shared/validation';
import { decryptSecret, encryptSecret, generatePassword, generateRecoveryCode, randomToken, sha256Hex } from './crypto';

const KEY = Buffer.alloc(32, 1).toString('base64');

describe('crypto helpers', () => {
  it('round-trips AES-GCM and uses a fresh IV each time', () => {
    const a = encryptSecret('JBSWY3DPEHPK3PXPJBSWY3DP', KEY);
    const b = encryptSecret('JBSWY3DPEHPK3PXPJBSWY3DP', KEY);
    expect(a).not.toEqual(b);
    expect(decryptSecret(a, KEY)).toBe('JBSWY3DPEHPK3PXPJBSWY3DP');
  });

  it('detects tampering and wrong keys', () => {
    const enc = encryptSecret('secret', KEY);
    const [iv, tag, data] = enc.split('.');
    const flipped = Buffer.from(data, 'base64url');
    flipped[0] ^= 1;
    expect(() => decryptSecret([iv, tag, flipped.toString('base64url')].join('.'), KEY)).toThrow();
    expect(() => decryptSecret(enc, Buffer.alloc(32, 2).toString('base64'))).toThrow();
    expect(() => decryptSecret('garbage', KEY)).toThrow();
  });

  it('generates passwords that always satisfy the shared policy', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword();
      expect(pw).toHaveLength(16);
      expect(isStrongPassword(pw)).toBe(true);
      expect(pw).not.toMatch(/[0O1lI]/);
    }
  });

  it('generates well-formed recovery codes and tokens', () => {
    expect(generateRecoveryCode()).toMatch(RECOVERY_CODE_PATTERN);
    expect(randomToken(32)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
