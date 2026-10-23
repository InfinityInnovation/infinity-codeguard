import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { parseEnvironment } from '@codeguard/config';
import { GlobalErrorFilter } from './common/global-error.filter';

async function bootstrap(): Promise<void> {
  const env = parseEnvironment(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalFilters(new GlobalErrorFilter());
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Infinity CodeGuard API')
      .setVersion('1')
      .addCookieAuth('cg_session')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);
  await app.listen(env.PORT, '0.0.0.0');
}

void bootstrap();
