import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { sessionMiddleware } from './auth/session.config';
import { sessionBindingMiddleware } from './auth/session-binding.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  if (config.get<string>('NODE_ENV') === 'production') app.getHttpAdapter().getInstance().set('trust proxy', 1);
  // Private patient and session endpoints must never be stored in HTTP caches.
  // Disable entity tags to prevent accidental 304 responses to authenticated data.
  app.getHttpAdapter().getInstance().disable('etag');
  app.use((req: {path: string}, res: {setHeader: (name: string, value: string) => void}, next: () => void) => {
    if (/^\/(auth|dashboard|workspace)(\/|$)/.test(req.path)) {
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });
  app.use(helmet());
  app.use(sessionMiddleware(config));
  app.use(sessionBindingMiddleware(config));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(value => value.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  await app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
}
void bootstrap();
