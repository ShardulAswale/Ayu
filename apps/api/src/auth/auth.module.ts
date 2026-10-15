import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PasswordService } from './password.service';
import { User, UserSchema } from './user.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  providers: [PasswordService],
  exports: [PasswordService, MongooseModule],
})
export class AuthModule {}
