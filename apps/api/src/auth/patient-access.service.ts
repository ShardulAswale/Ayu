import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from './user.schema';

export interface Principal {
  id: string;
  role: UserRole;
}

@Injectable()
export class PatientAccessService {
  assertCanReadPatient(principal: Principal | null, patientUserId: string, assignedDietitianId?: string): void {
    if (!principal) throw new UnauthorizedException();
    if (principal.role === 'admin') return;
    if (principal.role === 'patient' && principal.id === patientUserId) return;
    if (principal.role === 'dietitian' && assignedDietitianId && principal.id === assignedDietitianId) return;
    throw new ForbiddenException('Patient access denied');
  }

  assertCanEditPlan(principal: Principal | null, assignedDietitianId?: string): void {
    if (!principal) throw new UnauthorizedException();
    if (principal.role === 'admin') return;
    if (principal.role === 'dietitian' && assignedDietitianId && principal.id === assignedDietitianId) return;
    throw new ForbiddenException('Plan editing denied');
  }
}
