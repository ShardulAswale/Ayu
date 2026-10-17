import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User, UserRole } from '../auth/user.schema';

type DashboardMetric = { key: string; label: string; count: number; description: string };
type DashboardSection = { key: string; title: string; description: string; items: never[] };

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  @Get('summary')
  @Roles('admin', 'dietitian', 'patient')
  async summary(@Req() request: Request): Promise<{
    role: UserRole; metrics: DashboardMetric[]; sections: DashboardSection[];
  }> {
    // RolesGuard validates the session, its version, and the current database role.
    const identity = await this.users.findById(request.session.userId).select('role').lean();
    const role = identity!.role;
    if (role === 'admin') {
      const [patients, dietitians, admins] = await Promise.all([
        this.users.countDocuments({ role: 'patient', active: true }),
        this.users.countDocuments({ role: 'dietitian', active: true }),
        this.users.countDocuments({ role: 'admin', active: true }),
      ]);
      return {
        role,
        metrics: [
          { key: 'patients', label: 'Active patients', count: patients, description: 'Active patient accounts' },
          { key: 'dietitians', label: 'Dietitians', count: dietitians, description: 'Active dietitian accounts' },
          { key: 'admins', label: 'Administrators', count: admins, description: 'Active administrator accounts' },
        ],
        sections: [
          { key: 'appointments', title: 'Appointments', description: 'No appointment records available yet.', items: [] },
          { key: 'reports', title: 'Reports', description: 'No reports available yet.', items: [] },
        ],
      };
    }
    if (role === 'dietitian') {
      // Assignment and clinical-data APIs do not exist yet. Never enumerate all patients.
      return {
        role,
        metrics: [
          { key: 'patients', label: 'My patients', count: 0, description: 'No assigned patient data available yet' },
          { key: 'plans', label: 'Nutrition plans', count: 0, description: 'No authorized plan records available yet' },
          { key: 'appointments', label: 'Appointments', count: 0, description: 'No appointments available yet' },
        ],
        sections: [
          { key: 'patients-list', title: 'My patients', description: 'No assigned patients to display.', items: [] },
          { key: 'schedule', title: 'Upcoming appointments', description: 'No appointments to display.', items: [] },
        ],
      };
    }
    return {
      role,
      metrics: [
        { key: 'plans', label: 'My nutrition plans', count: 0, description: 'No nutrition plans available yet' },
        { key: 'appointments', label: 'My appointments', count: 0, description: 'No consultations available yet' },
        { key: 'progress', label: 'Progress entries', count: 0, description: 'No progress records available yet' },
      ],
      sections: [
        { key: 'nutrition', title: 'My nutrition', description: 'No nutrition plans to display.', items: [] },
        { key: 'schedule', title: 'Upcoming appointments', description: 'No upcoming appointments to display.', items: [] },
      ],
    };
  }
}
