import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** OWASP-recommended argon2id parameters (19 MiB, t=2, p=1). */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  /** Verified against when the username does not exist, so timing does not reveal it. */
  private readonly dummyHash = argon2.hash('wolfcar-timing-equaliser', ARGON2_OPTIONS);

  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(hash: string | null | undefined, password: string): Promise<boolean> {
    if (!hash) {
      await this.verifyDummy(password);
      return false;
    }
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  async verifyDummy(password: string): Promise<void> {
    try {
      await argon2.verify(await this.dummyHash, password);
    } catch {
      // ignored — only here to spend the same time as a real verification
    }
  }
}
