import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthController } from './health.controller';

const uri = process.env.MONGODB_URI;
if (!uri || !uri.startsWith('mongodb+srv://') && !uri.startsWith('mongodb://')) {
  throw new Error('MONGODB_URI must be configured with a MongoDB connection URI');
}
if (!/\/Ayu(?:\?|$)/.test(uri)) {
  throw new Error('MONGODB_URI must explicitly select the Ayu database');
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(uri, { serverSelectionTimeoutMS: 5000 }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
