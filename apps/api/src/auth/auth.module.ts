import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesGuard } from './roles.guard';
import { PatientAccessService } from './patient-access.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { CsrfGuard } from './csrf.guard';
import { PasswordService } from './password.service';
import { User, UserSchema } from './user.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [AuthController],
  providers: [PasswordService, AuthGuard, CsrfGuard, RolesGuard, PatientAccessService],
  exports: [PasswordService, AuthGuard, RolesGuard, PatientAccessService, MongooseModule],
})
export class AuthModule {}
