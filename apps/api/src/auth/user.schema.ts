import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;
export type UserRole = 'admin' | 'dietitian' | 'patient';

@Schema({ collection: 'Users', timestamps: true, versionKey: false })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ required: true, enum: ['admin', 'dietitian', 'patient'] })
  role!: UserRole;

  @Prop({ default: true })
  active!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ default: 0 })
  sessionVersion!: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
