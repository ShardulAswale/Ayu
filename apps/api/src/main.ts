import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(value => value.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  await app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
}
void bootstrap();
