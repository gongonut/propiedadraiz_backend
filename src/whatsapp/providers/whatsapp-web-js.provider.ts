import { Client, LocalAuth, Message, MessageMedia } from 'whatsapp-web.js';
import { IWhatsAppProvider, Button, GenericMessage } from './whatsapp-provider.interface';
import { EventEmitter } from 'events';
import { Injectable, Logger } from '@nestjs/common';
// No es estrictamente necesario para la lógica de emisión, pero es común para mostrar el QR en terminal
// import * as qrcode from 'qrcode-terminal';

@Injectable()
export class WhatsappWebJsProvider implements IWhatsAppProvider {
    events = new EventEmitter();
    private client: Client;
    private logger: Logger = new Logger(WhatsappWebJsProvider.name);
    private qrCodeData: string | null = null; // Para almacenar el QR si se genera

    async initialize(sessionId: string): Promise<void> {
        this.logger.log(`Initializing WhatsappWebJsProvider for session: ${sessionId}`);

        // Asegúrate de que la carpeta de sesiones exista
        // LocalAuth guarda los datos de la sesión en la carpeta 'sessions' por defecto
        // Puedes especificar una ruta diferente si lo necesitas
        this.client = new Client({
            authStrategy: new LocalAuth({ clientId: sessionId }),
            puppeteer: {
                headless: true, // Ejecutar en modo sin cabeza (sin interfaz gráfica)
                args: [
                    '--no-sandbox', // Deshabilita el sandbox de Chrome, a menudo necesario en entornos de servidor
                    '--disable-setuid-sandbox', // Deshabilita el sandbox de setuid, también común en servidores
                    '--disable-gpu', // Deshabilita la aceleración de hardware de GPU
                    '--disable-dev-shm-usage', // Soluciona problemas de memoria en algunos entornos Docker
                    '--no-zygote', // Deshabilita el proceso zygote de Chrome
                    '--single-process', // Ejecuta el navegador en un solo proceso, útil para Windows
                    '--disable-web-security', // Puede ser necesario en algunos entornos, usar con precaución
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-translate',
                    '--disable-extensions',
                    '--disable-component-extensions-with-background-pages',
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-breakpad',
                    '--disable-client-side-phishing-detection',
                    '--disable-sync',
                    '--metrics-recording-only',
                    '--disable-features=site-per-process,TranslateUI,BlinkGenPropertyTrees',
                    '--disable-hang-monitor',
                    '--disable-prompt-on-repost',
                    '--disable-domain-reliability',
                    '--disable-renderer-backgrounding',
                    '--disable-component-update',
                    '--mute-audio'
                ],
            },
        });

        // Evento cuando se genera un código QR
        this.client.on('qr', (qr) => {
            this.logger.log(`QR Code generated for session ${sessionId}.`);
            this.qrCodeData = qr; // Almacena el QR
            this.events.emit('qr', qr);
            // Opcional: para mostrar el QR en la terminal si qrcode-terminal está instalado
            // qrcode.generate(qr, { small: true });
        });

        // Evento cuando el cliente está listo y autenticado
        this.client.on('ready', () => {
            this.logger.log(`Client is ready for session ${sessionId}!`);
            this.qrCodeData = null; // Limpia el QR una vez conectado
            const status = { status: 'open', user: this.client.info.me };
            this.events.emit('status', status);
        });

        // Evento para mensajes entrantes
        // El evento 'message' está obsoleto y puede no capturar todos los mensajes.
        // 'message_create' es el evento recomendado. Captura todos los mensajes creados,
        // incluidos los enviados por el propio bot, por lo que el filtro 'fromMe' es importante.
        this.client.on('message_create', async (message: Message) => {
            // Filtrar mensajes enviados por el propio bot para evitar bucles de conversación.
            if (message.fromMe) return;

            const genericMessage: GenericMessage = {
                from: message.from,
                text: message.body,
                isFromMe: message.fromMe,
                originalMessage: message, // Puedes pasar el objeto de mensaje original si necesitas más detalles
                sessionId: sessionId,
            };
            this.events.emit('message', genericMessage);
        });

        // Evento cuando el cliente se desconecta
        this.client.on('disconnected', (reason) => {
            this.logger.warn(`Client disconnected for session ${sessionId}. Reason: ${reason}`);
            this.qrCodeData = null; // Limpia el QR al desconectarse
            const status = { status: 'close', reason: new Error(reason as string), shouldReconnect: true };
            this.events.emit('status', status);
        });

        // Evento en caso de fallo de autenticación
        this.client.on('auth_failure', (msg) => {
            this.logger.error(`Authentication failure for session ${sessionId}: ${msg}`);
            this.qrCodeData = null; // Limpia el QR en caso de fallo de autenticación
            const status = { status: 'close', reason: new Error(`Auth Failure: ${msg}`), shouldReconnect: false };
            this.events.emit('status', status);
        });

        // Evento cuando el estado de conexión cambia
        this.client.on('change_state', (state) => {
            this.logger.debug(`Connection state changed for session ${sessionId}: ${state}`);
            // Aquí podrías emitir actualizaciones de estado más granulares si es necesario
        });

        // Inicializa el cliente de whatsapp-web.js
        await this.client.initialize();
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            this.logger.log('Logging out WhatsappWebJsProvider client.');
            await this.client.logout();
            this.client = null; // Limpiar la instancia del cliente después de cerrar sesión
            this.qrCodeData = null;
        }
    }

    async sendMessage(to: string, message: string): Promise<void> {
        if (!this.client || !(await this.client.getState() === 'CONNECTED')) {
            throw new Error('WhatsappWebJsProvider client is not ready or connected.');
        }
        await this.client.sendMessage(to, message);
    }

    async sendButtonsMessage(to: string, text: string, footer: string, buttons: Button[]): Promise<void> {
        if (!this.client || !(await this.client.getState() === 'CONNECTED')) {
            throw new Error('WhatsappWebJsProvider client is not ready or connected.');
        }

        // whatsapp-web.js tiene un formato específico para los botones
        const wwebButtons = buttons.map(btn => ({
            buttonId: btn.id,
            buttonText: { displayText: btn.text },
            type: 1, // Tipo de botón de respuesta rápida
        }));

        const buttonMessage = {
            body: text, // Corregido: 'text' debe ser 'body' para el contenido principal del mensaje
            footer: footer,
            buttons: wwebButtons,
        };

        this.logger.debug(`Sending buttons message to ${to}: ${JSON.stringify(buttonMessage)}`);
        await this.client.sendMessage(to, buttonMessage);
    }

    async sendImageMessage(to: string, imageUrl: string, caption?: string): Promise<void> {
        if (!this.client || !(await this.client.getState() === 'CONNECTED')) {
            throw new Error('WhatsappWebJsProvider client is not ready or connected.');
        }

        try {
            let media: MessageMedia;
            
            // Verificar si es una URL remota o un path local
            if (imageUrl.startsWith('http')) {
                // Es una URL remota
                media = await MessageMedia.fromUrl(imageUrl);
            } else {
                // Asumimos que es un path local relativo a la carpeta public
                // El path suele venir como /uploads/properties/imagen.jpg
                // Necesitamos resolverlo al sistema de archivos local
                const path = require('path');
                const fs = require('fs');
                
                // Construir ruta absoluta: backend/public + imageUrl
                const publicDir = path.join(process.cwd(), 'public');
                // Quitamos el slash inicial si existe para evitar problemas con join
                const relativePath = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
                const absolutePath = path.join(publicDir, relativePath);

                if (fs.existsSync(absolutePath)) {
                    media = MessageMedia.fromFilePath(absolutePath);
                } else {
                    // Fallback: intentar tratarlo como URL si no existe el archivo (por si acaso es un esquema raro)
                     this.logger.warn(`File not found at ${absolutePath}, attempting to fetch as URL.`);
                     media = await MessageMedia.fromUrl(imageUrl);
                }
            }
            
            await this.client.sendMessage(to, media, { caption: caption });
        } catch (error) {
            this.logger.error(`Failed to send image message to ${to} for session. Error: ${error.message}`);
            throw error;
        }
    }

    // Método adicional para obtener el QR si es necesario desde fuera del evento
    async getQr(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (this.qrCodeData) {
                resolve(this.qrCodeData);
            } else {
                // Si no hay QR, podría ser que ya esté conectado o que haya un error
                this.client.getState().then(state => {
                    if (state === 'CONNECTED') {
                        reject(new Error('Client is already connected, no QR code available.'));
                    } else {
                        reject(new Error('QR code not generated yet or client is not in a QR state.'));
                    }
                }).catch(err => reject(new Error(`Error getting client state: ${err.message}`)));
            }
        });
    }

    async getStatus(): Promise<string> {
        if (this.client) {
            const state = await this.client.getState();
            return state ? state.toUpperCase() : 'UNKNOWN';
        }
        return 'NOT_INITIALIZED';
    }
}