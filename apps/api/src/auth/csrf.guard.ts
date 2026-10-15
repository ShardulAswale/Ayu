import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = req.session?.csrfToken;
    const supplied = req.header('x-ayu-csrf');
    if (!expected || !supplied) throw new ForbiddenException('Invalid CSRF token');
    const a = Buffer.from(expected);
    const b = Buffer.from(supplied);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ForbiddenException('Invalid CSRF token');
    return true;
  }
}
