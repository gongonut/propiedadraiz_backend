import { Module, forwardRef, Scope } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';
import { WHATSAPP_PROVIDER } from './providers/whatsapp-provider.interface';
import { BaileysProvider } from './providers/baileys.provider';
import { WhatsappWebJsProvider } from './providers/whatsapp-web-js.provider';
import { WhatsappCloudProvider } from './providers/whatsapp-cloud.provider';
import { WhatsappGateway } from './whatsapp.gateway';
import { BotsModule } from '../bots/bots.module';
import { ConversationModule } from '../conversation/conversation.module';
import { WhatsappWebhookController } from './whatsapp.controller';

@Module({
  imports: [ConfigModule, forwardRef(() => BotsModule), forwardRef(() => ConversationModule)],
  controllers: [
    // Este controlador es solo para la integración con WhatsApp Cloud API.
    // No será utilizado en la implementación inicial con whatsapp-web.js.
    WhatsappWebhookController,
  ],
  providers: [
    WhatsappService,
    WhatsappGateway,
    // Para cambiar de proveedor, descomenta el proveedor deseado y comenta los otros.
    // { provide: WHATSAPP_PROVIDER, useClass: BaileysProvider, scope: Scope.TRANSIENT },
    { provide: WHATSAPP_PROVIDER, useClass: WhatsappWebJsProvider, scope: Scope.TRANSIENT },
    // { provide: WHATSAPP_PROVIDER, useClass: WhatsappCloudProvider, scope: Scope.TRANSIENT }, // Nuevo Proveedor WhatsApp Cloud API
  ],
  exports: [WhatsappService, WHATSAPP_PROVIDER],
})
export class WhatsappModule {}
