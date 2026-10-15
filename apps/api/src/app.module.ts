import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGODB_URI');
        if (!uri || !(uri.startsWith('mongodb+srv://') || uri.startsWith('mongodb://'))) {
          throw new Error('MONGODB_URI must be configured with a MongoDB connection URI');
        }
        if (!/\/Ayu(?:\?|$)/.test(uri)) {
          throw new Error('MONGODB_URI must explicitly select the Ayu database');
        }
        return { uri, serverSelectionTimeoutMS: 5000 };
      },
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
