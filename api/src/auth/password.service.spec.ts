import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with argon2id and verifies', async () => {
    const hash = await service.hash('Str0ng#Password!');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    await expect(service.verify(hash, 'Str0ng#Password!')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong')).resolves.toBe(false);
  });

  it('returns false for missing or malformed hashes', async () => {
    await expect(service.verify(null, 'x')).resolves.toBe(false);
    await expect(service.verify('not-a-hash', 'x')).resolves.toBe(false);
  });
});
