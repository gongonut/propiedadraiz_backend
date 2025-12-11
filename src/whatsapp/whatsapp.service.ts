import { Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Cron, CronExpression } from '@nestjs/schedule';
import { promises as fs } from 'fs';
import { join } from 'path';

import { BotsService } from '../bots/bots.service';
import { BotDocument } from '../bots/schemas/bot.schema';
import { ConversationService } from '../conversation/conversation.service';
import { Button, GenericMessage, IWhatsAppProvider, WHATSAPP_PROVIDER } from './providers/whatsapp-provider.interface';
import { WhatsappGateway } from './whatsapp.gateway';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private sessions = new Map<string, IWhatsAppProvider>();
  private readonly SESSIONS_DIR = join(process.cwd(), 'auth_info_baileys');
  private readonly QR_CODE_TIMEOUT = 30000; // 30 seconds

  constructor(
    private readonly botsService: BotsService,
    private readonly gateway: WhatsappGateway,
    private readonly moduleRef: ModuleRef,
    @Inject(forwardRef(() => ConversationService))
    private readonly conversationService: ConversationService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing WhatsApp service and starting active bots...');
    const bots = await this.botsService.findAllActive();
    for (const bot of bots) {
      this.startBotSession(bot, false).catch(error =>
        this.logger.error(`Failed to auto-start session for ${bot.sessionId}: ${error.message}`),
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'purge_old_sessions', timeZone: 'America/Bogota' })
  async handlePurgeOldSessions() {
    this.logger.log('Running scheduled job: Purging old WhatsApp session directories...');
    try {
      const activeSessionIds = new Set(this.sessions.keys());
      const allSessionDirs = await fs.readdir(this.SESSIONS_DIR, { withFileTypes: true });

      const deletionPromises = allSessionDirs
        .filter(dirent => dirent.isDirectory() && !activeSessionIds.has(dirent.name))
        .map(dirent => {
          const dirPath = join(this.SESSIONS_DIR, dirent.name);
          this.logger.log(`Deleting inactive session directory: ${dirPath}`);
          return fs.rm(dirPath, { recursive: true, force: true });
        });

      await Promise.all(deletionPromises);
      this.logger.log('Finished purging old WhatsApp session directories.');
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn('Session directory not found, skipping purge. It will be created on first session init.');
      } else {
        this.logger.error('Error purging old WhatsApp session directories', error.stack);
      }
    }
  }

  async startBotSession(bot: BotDocument, useTimeout = true): Promise<string | null> {
    if (this.sessions.has(bot.sessionId)) {
      this.logger.warn(`Session start requested for already active session: ${bot.sessionId}`);
      return null;
    }

    this.logger.log(`Starting bot session for: ${bot.name} (${bot.sessionId})`);
    const session = await this.moduleRef.resolve<IWhatsAppProvider>(WHATSAPP_PROVIDER);
    this.sessions.set(bot.sessionId, session);

    // Registrar el listener de mensajes aquí, fuera de la promesa de conexión.
    // Esto asegura que siempre estemos escuchando mensajes mientras la sesión exista.
    session.events.on('message', (genericMessage: GenericMessage) => {
      this.conversationService.handleIncomingMessage(genericMessage);
    });

    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      if (useTimeout) {
        timeoutId = setTimeout(() => {
          this.logger.error(`Timeout waiting for QR code for session ${bot.sessionId}`);
          this.stopBotSession(bot.sessionId).catch(e => this.logger.error(`Error stopping session on timeout: ${e.stack}`));
          reject(new Error('Timeout waiting for QR code'));
        }, this.QR_CODE_TIMEOUT);
      }

      // Definimos los handlers antes para tener una referencia con el tipo correcto.
      // Esto resuelve el error TS2345.
      const qrHandler = (qr: string) => {
        this.logger.log(`QR Code generated for ${bot.sessionId}.`);
        this.botsService.update(bot.id, { qr, status: 'pairing' }).catch(e => this.logger.error(`Error updating bot on QR: ${e.stack}`));
        this.gateway.sendQrCode(bot.sessionId, qr);
        resolve(qr);
      };

      const statusHandler = async (statusEvent) => {
        this.logger.debug(`Session status for ${bot.sessionId}: ${JSON.stringify(statusEvent)}`);

        if (statusEvent.status === 'open') {
          cleanup();
          // The user object from whatsapp-web.js might not have an 'id' property.
          // It's safer to use '_serialized' which is the JID (e.g., '1234567890@c.us').
          // The 'user' property also contains the number, but '_serialized' is more standard.
          const phoneNumber = statusEvent.user?._serialized?.split('@')[0] || statusEvent.user?.user;
          await this.botsService.update(bot.id, { phoneNumber, qr: '', status: 'active' });
          this.gateway.sendStatus(bot.sessionId, 'active');
          resolve(null);
        } else if (statusEvent.status === 'close') {
          cleanup();
          this.sessions.delete(bot.sessionId);
          await this.botsService.update(bot.id, { status: 'inactive' });
          this.gateway.sendStatus(bot.sessionId, 'inactive');

          const reason = statusEvent.reason as Error;
          const isConnectionFailure = reason?.message === 'Connection Failure';

          if (isConnectionFailure) {
            this.logger.error(`Connection Failure for session ${bot.sessionId}. Deleting session files and restarting.`);
            const sessionPath = join(this.SESSIONS_DIR, bot.sessionId);
            try {
              await fs.rm(sessionPath, { recursive: true, force: true });
              this.logger.log(`Deleted session directory: ${sessionPath}`);
            } catch (fsError) {
              this.logger.error(`Failed to delete session directory ${sessionPath}`, fsError.stack);
            } finally {
              // Restart without timeout and without rejecting the promise to avoid crashes
              this.startBotSession(bot, false).catch(err => this.logger.error(`Failed to restart session ${bot.sessionId} after connection failure`, err.stack));
            }
          } else if (statusEvent.shouldReconnect) {
            this.logger.log(`Reconnecting session ${bot.sessionId} in 5 seconds...`);
            setTimeout(() => {
              this.startBotSession(bot, false).catch(err => this.logger.error(`Failed to restart session on reconnect: ${err.stack}`));
            }, 5000);
          }
        }
      };

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        // Eliminamos los listeners específicos de esta conexión para evitar fugas de memoria.
        // El listener de 'message' permanece activo.
        session.events.removeListener('qr', qrHandler);
        session.events.removeListener('status', statusHandler);
      };

      session.events.on('status', statusHandler);
      session.events.on('qr', qrHandler);

      session.initialize(bot.sessionId).catch(error => {
        cleanup();
        this.logger.error(`Failed to initialize bot session ${bot.sessionId}`, error.stack);
        this.sessions.delete(bot.sessionId);
        this.botsService.update(bot.id, { status: 'error' }).catch(e => this.logger.error(`Error updating bot on init error: ${e.stack}`));
        this.gateway.sendStatus(bot.sessionId, 'error');
        reject(error);
      });
    });
  }

  /**
   * Maneja los mensajes entrantes desde la API de WhatsApp Cloud a través del Webhook.
   * Este flujo es diferente ya que no se basa en un listener de eventos de socket.
   * @param sessionId - El ID del número de teléfono que recibió el mensaje.
   * @param genericMessage - El mensaje procesado.
   */
  async handleIncomingCloudMessage(sessionId: string, genericMessage: GenericMessage) {
    this.logger.log(`Mensaje entrante para la sesión ${sessionId} (Cloud API): ${genericMessage.text}`);
    this.conversationService.handleIncomingMessage(genericMessage);
  }

  async stopBotSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.logger.log(`Stopping bot session: ${sessionId}`);
      await session.disconnect();
      this.sessions.delete(sessionId);
    } else {
      this.logger.warn(`Attempted to stop a non-existent session: ${sessionId}`);
    }
  }

  async sendMessage(sessionId: string, to: string, message: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.sendMessage(to, message);
    } else {
      this.logger.warn(`Attempted to send message via non-existent session: ${sessionId}`);
      throw new Error(`Session ${sessionId} not found.`);
    }
  }

  async sendButtonsMessage(sessionId: string, to: string, text: string, footer: string, buttons: Button[]): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.sendButtonsMessage(to, text, footer, buttons);
    } else {
      this.logger.warn(`Attempted to send buttons via non-existent session: ${sessionId}`);
      throw new Error(`Session ${sessionId} not found.`);
    }
  }

  async sendImageMessage(sessionId: string, to: string, imageUrl: string, caption?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    // The optional chaining ?. ensures the method exists before calling it.
    if (session && session.sendImageMessage) {
      await session.sendImageMessage(to, imageUrl, caption);
    } else {
      this.logger.warn(`Attempted to send image via non-existent or unsupported session: ${sessionId}`);
      throw new Error(`Session ${sessionId} not found or provider does not support sendImageMessage.`);
    }
  }
}