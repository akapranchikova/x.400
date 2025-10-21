import type { Folder, Message, MessageEnvelope, X400Address } from '@x400/shared';

export interface ISession {
  sessionId: string;
  connectedAt: string;
  peer: string;
}

export interface ISubmitResult {
  messageId: string;
  queueReference: string;
  status: 'accepted' | 'queued' | 'failed';
  diagnosticCode?: string;
}

export interface IFolderService {
  listFolders(): Promise<Folder[]>;
}

export interface IMessageService {
  listMessages(folderId: string): Promise<MessageEnvelope[]>;
  getMessage(messageId: string): Promise<Message>;
  submitMessage(envelope: MessageEnvelope, content: string): Promise<ISubmitResult>;
  deleteMessage(messageId: string): Promise<void>;
  moveMessage(messageId: string, folderId: string): Promise<void>;
  archiveMessage(messageId: string): Promise<void>;
}

export interface ITraceService {
  bundle(): Promise<{ entries: unknown[] }>;
}

export interface IX400Transport {
  connect(): Promise<ISession>;
  folders: IFolderService;
  messages: IMessageService;
  trace: ITraceService;
  compose(payload: {
    sender: X400Address;
    recipients: X400Address[];
    subject: string;
    body: string;
  }): Promise<ISubmitResult>;
}

export type TransportFactory = (options?: TransportOptions) => IX400Transport;

export interface TransportOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}
