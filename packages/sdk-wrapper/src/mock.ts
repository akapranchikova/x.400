import {
  Folder,
  Message,
  MessageEnvelope,
  folderListSchema,
  messageSchema,
  messageEnvelopeSchema,
} from '@x400/shared';
import axios, { AxiosInstance } from 'axios';

import { IX400Transport, ISubmitResult, TransportFactory, TransportOptions } from './interfaces';

const DEFAULT_BASE_URL = 'http://127.0.0.1:7878';

const createClient = (options: TransportOptions = {}): AxiosInstance => {
  const instance = axios.create({
    baseURL: options.baseUrl ?? DEFAULT_BASE_URL,
    timeout: options.timeoutMs ?? 5_000,
    headers: {
      'Content-Type': 'application/json',
      ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
    },
  });

  return instance;
};

const normalizeSubmitResult = (payload: any): ISubmitResult => ({
  messageId: payload.messageId ?? payload.message_id ?? '',
  queueReference: payload.queueReference ?? payload.queue_reference ?? '',
  status: (payload.status ?? 'queued') as ISubmitResult['status'],
  diagnosticCode: payload.diagnosticCode ?? payload.diagnostic_code,
});

export const createMockTransport: TransportFactory = (options) => {
  const client = createClient(options);

  const connect = async () => ({
    sessionId:
      globalThis.crypto && 'randomUUID' in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    connectedAt: new Date().toISOString(),
    peer: client.defaults.baseURL ?? DEFAULT_BASE_URL,
  });

  const folders = {
    async listFolders(): Promise<Folder[]> {
      const response = await client.get('/folders');
      const parsed = folderListSchema.parse(response.data);
      return parsed;
    },
  };

  const messages = {
    async listMessages(folderId: string): Promise<MessageEnvelope[]> {
      const response = await client.get('/messages', { params: { folder: folderId } });
      const items = Array.isArray(response.data) ? response.data : [];
      return items.map((item) => messageEnvelopeSchema.parse(item));
    },
    async getMessage(messageId: string): Promise<Message> {
      const response = await client.get(`/messages/${messageId}`);
      return messageSchema.parse(response.data);
    },
    async submitMessage(envelope: MessageEnvelope, content: string): Promise<ISubmitResult> {
      const response = await client.post('/submit', {
        envelope,
        content: {
          text: content,
          attachments: [],
        },
      });
      return normalizeSubmitResult(response.data);
    },
    async deleteMessage(messageId: string): Promise<void> {
      await client.delete(`/messages/${messageId}`);
    },
    async moveMessage(messageId: string, folderId: string): Promise<void> {
      await client.post(`/messages/${messageId}/move`, { folder_id: folderId });
    },
    async archiveMessage(messageId: string): Promise<void> {
      await client.post(`/messages/${messageId}/archive`);
    },
  };

  const trace = {
    async bundle() {
      const response = await client.get('/trace/bundle');
      return response.data as { entries: unknown[] };
    },
  };

  const compose = async (payload: {
    sender: MessageEnvelope['sender'];
    recipients: MessageEnvelope['to'];
    subject: string;
    body: string;
  }) => {
    const response = await client.post('/compose', payload);
    return normalizeSubmitResult(response.data);
  };

  return {
    connect,
    folders,
    messages,
    trace,
    compose,
  } satisfies IX400Transport;
};

export type MockTransport = ReturnType<typeof createMockTransport>;
