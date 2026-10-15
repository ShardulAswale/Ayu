import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHmac } from 'node:crypto';

@Injectable()
export class PasswordService {
  private get pepper(): string {
    const pepper = process.env.AUTH_PASSWORD_PEPPER;
    if (!pepper || pepper.length < 32) throw new Error('AUTH_PASSWORD_PEPPER must be at least 32 characters');
    return pepper;
  }

  private prehash(password: string): Buffer {
    return createHmac('sha256', this.pepper).update(password, 'utf8').digest();
  }

  async hash(password: string): Promise<string> {
    return argon2.hash(this.prehash(password), {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, this.prehash(password));
    } catch {
      return false;
    }
  }
}
