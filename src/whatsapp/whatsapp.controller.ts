import { Controller, Post, Body, Get, Query, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { GenericMessage } from './providers/whatsapp-provider.interface';
import { ConfigService } from '@nestjs/config';

@Controller('whatsapp/webhook')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);
  private readonly verifyToken: string;

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly configService: ConfigService,
  ) {
    this.verifyToken = this.configService.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    if (!this.verifyToken) {
      this.logger.warn('WHATSAPP_WEBHOOK_VERIFY_TOKEN no está configurado. La verificación del Webhook fallará.');
    }
  }

  // Endpoint para la verificación del webhook de Meta
  @Get()
  verifyWebhook(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) {
    if (mode === 'subscribe' && token === this.verifyToken) {
      this.logger.log('Webhook verificado exitosamente!');
      return challenge;
    }
    this.logger.warn(`Fallo en la verificación del Webhook. Token recibido: ${token}`);
    throw new Error('Fallo en la verificación del Webhook.');
  }

  // Endpoint para recibir mensajes entrantes de Meta
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any) {
    this.logger.debug(`Payload de Webhook de WhatsApp recibido: ${JSON.stringify(payload)}`);

    const messageEntry = payload.entry?.[0];
    const messageChange = messageEntry?.changes?.[0];
    const messageValue = messageChange?.value;
    const message = messageValue?.messages?.[0];

    if (message && messageValue.metadata?.phone_number_id) {
      const phoneNumberId = messageValue.metadata.phone_number_id;
      const from = message.from;
      let textContent = '';

      if (message.type === 'text') {
        textContent = message.text?.body;
      } else if (message.type === 'interactive') {
        if (message.interactive?.type === 'button_reply') {
          textContent = message.interactive.button_reply.title;
        } else if (message.interactive?.type === 'list_reply') {
          textContent = message.interactive.list_reply.title;
        }
      }

      const genericMessage: GenericMessage = {
        from: from,
        text: textContent,
        isFromMe: false,
        originalMessage: payload,
        sessionId: phoneNumberId,
      };

      await this.whatsappService.handleIncomingCloudMessage(phoneNumberId, genericMessage);
    }
    return { status: 'ok' };
  }
}