import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'], // Habilita todos los niveles de logging
  });
  
  app.useStaticAssets(join(__dirname, '..', 'public'));

  const allowedOrigins = [
    'http://localhost:4202',
    'http://localhost:4203',
    'http://localhost:3000',
    'https://ventawpcatalogo.up.railway.app'
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
  Logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
