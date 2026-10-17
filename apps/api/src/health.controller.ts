import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  health() {
    return { status: 'ok', service: 'ayu-api' };
  }

  @Get('ready')
  readiness() {
    if (this.connection.readyState !== 1) throw new ServiceUnavailableException('Database unavailable');
    return { status: 'ready' };
  }
}
