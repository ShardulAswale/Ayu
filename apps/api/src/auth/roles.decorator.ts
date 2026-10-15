import { SetMetadata } from '@nestjs/common';
import { UserRole } from './user.schema';

export const ROLES_KEY = 'ayu:roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
