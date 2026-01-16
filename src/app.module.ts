import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { UsersModule } from './users/users.module';
import { PropertiesModule } from './properties/properties.module';
import { AuthModule } from './auth/auth.module';
import { LeadsModule } from './leads/leads.module';
import { BotsModule } from './bots/bots.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ConversationModule } from './conversation/conversation.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ServeStaticModule.forRoot(
      // 1. Archivos Públicos del Backend (Uploads, Imágenes, etc.)
      // Se sirven primero para asegurar que rutas como /uploads/xyz.jpg funcionen directamente.
      {
        rootPath: join(__dirname, '..', 'public'),
        serveRoot: '/', // Opcional: usar '/public' si se quiere prefijo, pero '/' mantiene compatibilidad.
      },
      // 2. Frontend Angular (SPA)
      // Debe ir al final o después de rutas específicas para actuar como fallback a index.html.
      {
        rootPath: join(__dirname, '..', 'frontend'),
        exclude: ['/api/(.*)'], // No interceptar rutas de la API
      },
      // 3. Futuras páginas estáticas pueden agregarse aquí como objetos adicionales.
      // Ejemplo: { rootPath: join(__dirname, '..', 'landing'), serveRoot: '/landing' }
    ),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
    }),
    UsersModule,
    PropertiesModule,
    AuthModule,
    UploadsModule,
    LeadsModule,
    BotsModule,
    WhatsappModule,
    ConversationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}