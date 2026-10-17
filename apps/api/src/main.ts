import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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
  // API documentation is disabled in production unless explicitly opted in.
  // Authentication uses an HttpOnly session cookie; mutations also require x-ayu-csrf.
  const enableSwagger = config.get<string>('SWAGGER_ENABLED') === 'true' ||
    (config.get<string>('NODE_ENV') !== 'production' && config.get<string>('SWAGGER_ENABLED') !== 'false');
  if (enableSwagger) {
    const documentConfig = new DocumentBuilder()
      .setTitle('Ayu API')
      .setDescription('Nutrition and patient-management API. Login requires GET /auth/csrf, then POST /auth/login using the CSRF token and session cookie. For protected write requests, send the current x-ayu-csrf header. Patient data is role- and assignment-scoped.')
      .setVersion('0.1.0')
      .addCookieAuth(config.get<string>('NODE_ENV') === 'production' ? '__Host-ayu.sid' : 'ayu.sid')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'x-ayu-csrf', description: 'CSRF token returned by /auth/csrf (refresh after login).' }, 'csrf')
      .build();
    const document = SwaggerModule.createDocument(app, documentConfig);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
      swaggerOptions: { persistAuthorization: false, withCredentials: true },
    });
  }
  await app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
}
void bootstrap();
