import { IWhatsAppProvider, Button, GenericMessage, User } from './whatsapp-provider.interface';
import { EventEmitter } from 'events';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class WhatsappCloudProvider implements IWhatsAppProvider {
    events = new EventEmitter(); // Usado para emitir eventos de estado (open/close) al WhatsappService
    private logger: Logger = new Logger(WhatsappCloudProvider.name);
    private accessToken: string;
    private phoneNumberId: string;
    private apiUrl: string;
    private currentSessionId: string; // Para rastrear la sesión a la que está asociado este proveedor

    constructor(private configService: ConfigService) {
        this.accessToken = this.configService.get<string>('WHATSAPP_CLOUD_API_TOKEN');
        this.phoneNumberId = this.configService.get<string>('WHATSAPP_CLOUD_PHONE_NUMBER_ID');

        if (!this.accessToken || !this.phoneNumberId) {
            this.logger.error('WHATSAPP_CLOUD_API_TOKEN o WHATSAPP_CLOUD_PHONE_NUMBER_ID no configurados en el servicio de configuración.');
            throw new Error('Las credenciales de la API de WhatsApp Cloud no están configuradas. Por favor, revisa tus variables de entorno.');
        }
        // La versión de la API (v18.0) puede necesitar ser actualizada periódicamente
        this.apiUrl = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
    }

    async initialize(sessionId: string): Promise<void> {
        this.currentSessionId = sessionId;
        this.logger.log(`Inicializando WhatsappCloudProvider para la sesión: ${sessionId}`);
        // Para la API de WhatsApp Cloud, la inicialización es principalmente tener las credenciales.
        // No hay una "conexión" que establecer desde el lado del cliente como con baileys/whatsapp-web.js.
        // Emitimos un evento 'status' para indicar que está listo para enviar mensajes.
        const user: User = { id: this.phoneNumberId, name: 'WhatsApp Cloud API' }; // Representa la API misma
        this.events.emit('status', { status: 'open', user: user });
        this.logger.log(`WhatsappCloudProvider listo para la sesión: ${sessionId}`);
    }

    async disconnect(): Promise<void> {
        this.logger.log(`Desconectando WhatsappCloudProvider para la sesión: ${this.currentSessionId} (no-op para Cloud API).`);
        // No hay una conexión persistente que desconectar para la API de WhatsApp Cloud.
        this.events.emit('status', { status: 'close', reason: new Error('Proveedor desconectado'), shouldReconnect: false });
    }

    private async sendApiRequest(to: string, messagePayload: any): Promise<void> {
        try {
            const headers = {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            };
            this.logger.debug(`Enviando mensaje a ${to} a través de WhatsApp Cloud API. Payload: ${JSON.stringify(messagePayload)}`);
            const response = await axios.post(this.apiUrl, {
                messaging_product: 'whatsapp',
                to: to,
                ...messagePayload,
            }, { headers });
            this.logger.log(`Mensaje enviado exitosamente a ${to}. Respuesta: ${JSON.stringify(response.data)}`);
        } catch (error) {
            this.logger.error(`Fallo al enviar mensaje a ${to} a través de WhatsApp Cloud API. Error: ${error.message}`, error.response?.data);
            throw new Error(`Fallo al enviar mensaje a través de WhatsApp Cloud API: ${error.message}`);
        }
    }

    async sendMessage(to: string, message: string): Promise<void> {
        const messagePayload = {
            type: 'text',
            text: { body: message },
        };
        await this.sendApiRequest(to, messagePayload);
    }

    async sendButtonsMessage(to: string, text: string, footer: string, buttons: Button[]): Promise<void> {
        const messagePayload = {
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text: text },
                footer: { text: footer },
                action: {
                    buttons: buttons.map(btn => ({
                        type: 'reply',
                        reply: { id: btn.id, title: btn.text }
                    }))
                }
            }
        };
        await this.sendApiRequest(to, messagePayload);
    }

    async sendImageMessage(to: string, imageUrl: string, caption?: string): Promise<void> {
        const messagePayload = {
            type: 'image',
            image: {
                link: imageUrl,
                caption: caption || undefined,
            },
        };
        await this.sendApiRequest(to, messagePayload);
    }

    async getQr(): Promise<string> {
        throw new Error('La API de WhatsApp Cloud no utiliza códigos QR para la autenticación.');
    }

    async getStatus(): Promise<string> {
        return 'CONNECTED';
    }
}