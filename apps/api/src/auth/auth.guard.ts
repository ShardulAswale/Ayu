import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';
import { User } from './user.schema';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const { userId, sessionVersion } = req.session || {};
    if (!userId || sessionVersion === undefined) throw new UnauthorizedException();
    const user = await this.users.findById(userId).select('active role sessionVersion').lean();
    if (!user?.active || user.sessionVersion !== sessionVersion) throw new UnauthorizedException();
    return true;
  }
}
