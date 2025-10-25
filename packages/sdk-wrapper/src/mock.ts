import {
  Folder,
  Message,
  MessageEnvelope,
  directoryEntrySchema,
  distributionListSchema,
  folderListSchema,
  gatewaySendResultSchema,
  inboundGatewayMessageSchema,
  messageSchema,
  messageEnvelopeSchema,
  migrationProgressSchema,
  migrationReportSchema,
  migrationRequestSchema,
  type MigrationRequest,
} from '@x400/shared';
import axios, { AxiosInstance } from 'axios';

import {
  IX400Transport,
  IServiceStatus,
  ISubmitResult,
  ITlsSummary,
  TransportFactory,
  TransportOptions,
} from './interfaces';

const DEFAULT_BASE_URL = 'http://127.0.0.1:7878';

type TransportError = Error & {
  status?: number;
  code?: string;
};

const createTransportError = (error: unknown): TransportError => {
  if (axios.isAxiosError(error)) {
    const message =
      typeof error.response?.data?.message === 'string'
        ? error.response.data.message
        : error.message;
    const transportError = new Error(message) as TransportError;
    transportError.name = 'X400TransportError';
    if (error.response?.status) {
      transportError.status = error.response.status;
    }
    if (typeof error.code === 'string') {
      transportError.code = error.code;
    }
    return transportError;
  }

  return error instanceof Error ? (error as TransportError) : new Error('Unknown transport error');
};

const createClient = (options: TransportOptions = {}): AxiosInstance => {
  const instance = axios.create({
    baseURL: options.baseUrl ?? DEFAULT_BASE_URL,
    timeout: options.timeoutMs ?? 5_000,
    headers: {
      'Content-Type': 'application/json',
      ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
    },
    proxy: false,
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(createTransportError(error)),
  );

  return instance;
};

const normalizeSubmitResult = (payload: any): ISubmitResult => ({
  messageId: payload.messageId ?? payload.message_id ?? '',
  queueReference: payload.queueReference ?? payload.queue_reference ?? '',
  status: (payload.status ?? 'queued') as ISubmitResult['status'],
  diagnosticCode: payload.diagnosticCode ?? payload.diagnostic_code,
});

const normalizeTls = (payload: any): ITlsSummary => ({
  enabled: Boolean(payload?.enabled),
  minVersion: String(payload?.min_version ?? payload?.minVersion ?? 'TLS1_3'),
  fingerprint: payload?.fingerprint ?? undefined,
  fingerprintMatches: Boolean(payload?.fingerprint_matches ?? payload?.fingerprintMatches ?? true),
  expiresAt: payload?.expires_at ?? payload?.expiresAt ?? undefined,
  error: payload?.error ?? undefined,
  ocspResponderConfigured: Boolean(
    payload?.ocsp_responder_configured ?? payload?.ocspResponderConfigured ?? false,
  ),
  revocationChecked: Boolean(payload?.revocation_checked ?? payload?.revocationChecked ?? false),
  warnings: Array.isArray(payload?.warnings)
    ? payload.warnings.map((entry: any) => String(entry))
    : [],
});

const normalizeStatus = (payload: any): IServiceStatus => ({
  transportMode:
    (payload?.transport_mode ?? payload?.transportMode ?? 'mock') === 'sdk' ? 'sdk' : 'mock',
  tls: normalizeTls(payload?.tls ?? {}),
  smimeEnabled: Boolean(payload?.smime_enabled ?? payload?.smimeEnabled ?? false),
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

  const migration = {
    async import(request: MigrationRequest) {
      const parsed = migrationRequestSchema.parse(request);
      const response = await client.post('/migration/import', parsed);
      const jobId = response.data?.jobId ?? response.data?.id;
      return { jobId: String(jobId) };
    },
    async progress(jobId: string) {
      const response = await client.get(`/migration/progress/${jobId}`);
      return migrationProgressSchema.parse(response.data);
    },
    async report(jobId: string) {
      const response = await client.get(`/migration/report/${jobId}`);
      return migrationReportSchema.parse(response.data);
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

  const status = async () => {
    const response = await client.get('/status');
    return normalizeStatus(response.data);
  };

  const gateway = {
    async send(payload: { to: string[]; subject: string; body: string; from?: string }) {
      const response = await client.post('/gateway/outbound', payload);
      return gatewaySendResultSchema.parse(response.data);
    },
    async peekInbound(limit?: number) {
      const response = await client.get('/gateway/inbound/peek', { params: { limit } });
      return {
        messages: inboundGatewayMessageSchema.array().parse(response.data ?? []),
      };
    },
    async acknowledge(ids: string[]) {
      const response = await client.post('/gateway/ack', { ids });
      return {
        acknowledged: Number(response.data?.acknowledged ?? ids.length),
      };
    },
    async preview(address: string) {
      const response = await client.post('/gateway/preview', { address });
      return {
        mapped: String(response.data?.mapped ?? ''),
        warnings: Array.isArray(response.data?.warnings)
          ? response.data.warnings.map((entry: any) => String(entry))
          : [],
      };
    },
  };

  const directory = {
    async search(query: string) {
      const response = await client.post('/directory/search', { query });
      const entries = Array.isArray(response.data?.entries)
        ? response.data.entries
        : Array.isArray(response.data)
          ? response.data
          : [];
      return entries.map((item: unknown) => directoryEntrySchema.parse(item));
    },
    async getEntry(id: string) {
      const response = await client.get(`/directory/entry/${id}`);
      if (!response.data) {
        return null;
      }
      return directoryEntrySchema.parse(response.data);
    },
    async getDistributionList(id: string) {
      const response = await client.get(`/directory/dl/${id}`);
      if (!response.data) {
        return null;
      }
      return distributionListSchema.parse(response.data);
    },
  };

  return {
    connect,
    folders,
    messages,
    trace,
    migration,
    gateway,
    directory,
    compose,
    status,
  } satisfies IX400Transport;
};

export type MockTransport = ReturnType<typeof createMockTransport>;
