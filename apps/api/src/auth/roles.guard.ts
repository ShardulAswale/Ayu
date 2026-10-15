import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';
import { User, UserRole } from './user.schema';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!required?.length) throw new ForbiddenException('Role policy required');
    const request = context.switchToHttp().getRequest<Request>();
    const { userId, sessionVersion } = request.session || {};
    if (!userId || sessionVersion === undefined) throw new UnauthorizedException();
    const user = await this.users.findById(userId).select('active role sessionVersion').lean();
    if (!user?.active || user.sessionVersion !== sessionVersion) throw new UnauthorizedException();
    if (!required.includes(user.role)) throw new ForbiddenException();
    return true;
  }
}
