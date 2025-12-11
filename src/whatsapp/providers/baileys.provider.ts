import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WAMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { Button, IWhatsAppProvider } from './whatsapp-provider.interface';
import * as pino from 'pino';

@Injectable()
export class BaileysProvider implements IWhatsAppProvider {
  sendImageMessage(to: string, imageUrl: string, caption?: string): Promise<void> {
    return this._sendImageMessage(to, imageUrl, caption);
  }

  events = new EventEmitter();
  protected sock: ReturnType<typeof makeWASocket> | null = null;
  private logger = new Logger(BaileysProvider.name);

  private ensureSock(): asserts this is { sock: NonNullable<typeof this.sock> } {
    if (!this.sock) {
      throw new Error('Baileys socket is not initialized. Call initialize(sessionId) first.');
    }
  }

  async initialize(sessionId: string): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(`auth_info_baileys/${sessionId}`);
    const pinoLogger = pino({ level: 'debug' });

    this.sock = makeWASocket({
      auth: state,
      logger: pinoLogger as any,
    });

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        this.events.emit('qr', qr);
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        this.logger.error(
          `Connection closed for session ${sessionId}, reason: ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`,
        );
        this.events.emit('status', { status: 'close', shouldReconnect });
      } else if (connection === 'open') {
        this.logger.log(`Connection opened for session ${sessionId}`);
        this.events.emit('status', { status: 'open', user: this.sock?.user });
      }
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('messages.upsert', (m) => {
      if (m.messages && m.messages.length > 0) {
        const message = m.messages[0];
        this.events.emit('message', message);
      }
    });
  }

  async sendMessage(to: string, message: string): Promise<void> {
    this.ensureSock();
    try {
      await this.sock.sendMessage(to, { text: message });
    } catch (err) {
      this.logger.error(`Failed to send text message to ${to}: ${err}`);
      throw err;
    }
  }

  async sendButtonsMessage(to: string, text: string, footer: string, buttons: Button[]): Promise<void> {
    this.ensureSock();

    const buttonsPayload = buttons.map((b) => ({
      buttonId: b.id,
      buttonText: { displayText: b.text },
      type: 1,
    }));

    const buttonMessage = {
      text,
      footer,
      buttons: buttonsPayload,
      headerType: 1,
    };

    this.logger.debug(`Sending buttons to ${to}: ${JSON.stringify(buttonMessage)}`);
    try {
      await this.sock.sendMessage(to, buttonMessage);
    } catch (err) {
      this.logger.error(`Failed to send buttons message to ${to}: ${err}`);
      throw err;
    }
  }

  private async _sendImageMessage(to: string, imageUrl: string, caption?: string): Promise<void> {
    this.ensureSock();
    const payload = {
      image: { url: imageUrl },
      caption: caption ?? undefined,
    };

    this.logger.debug(`Sending image to ${to}: ${imageUrl} (caption: ${caption ?? 'none'})`);
    try {
      await this.sock.sendMessage(to, payload);
    } catch (err) {
      this.logger.error(`Failed to send image message to ${to}: ${err}`);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.sock) return;
    try {
      // prefer graceful logout if available
      if (typeof this.sock.logout === 'function') {
        await this.sock.logout();
      } else if (typeof this.sock.ev?.removeAllListeners === 'function') {
        // fallback: remove listeners for known events
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.ev.removeAllListeners('messages.upsert');
      }
    } catch (err) {
      this.logger.error(`Error during disconnect: ${err}`);
    } finally {
      this.sock = null;
    }
  }
}
