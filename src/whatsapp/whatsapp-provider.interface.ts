import { EventEmitter } from 'events';

export const WHATSAPP_PROVIDER = 'WHATSAPP_PROVIDER';

export interface User {
  id: string;
  name: string;
}

export interface GenericMessage {
  from: string;
  text: string;
  isFromMe: boolean;
  originalMessage: any;
  sessionId: string;
}

export interface Button {
  id: string;
  text: string;
}

export interface IWhatsAppProvider {
  events: EventEmitter;
  initialize(sessionId: string): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(to: string, message: string): Promise<void>;
  sendButtonsMessage(to: string, text: string, footer: string, buttons: Button[]): Promise<void>;
  sendImageMessage?(to: string, imageUrl: string, caption?: string): Promise<void>;
}