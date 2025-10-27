import type {
  DistributionList,
  Folder,
  GatewaySendResult,
  Message,
  MessageEnvelope,
  MigrationProgress,
  MigrationReport,
  MigrationRequest,
  Report,
  DirectoryEntry,
  X400Address,
} from '@x400/shared';

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

export interface IMigrationService {
  import(request: MigrationRequest): Promise<{ jobId: string }>;
  progress(jobId: string): Promise<MigrationProgress>;
  report(jobId: string): Promise<MigrationReport>;
}

export interface IGatewayService {
  send(payload: {
    to: string[];
    subject: string;
    body: string;
    from?: string;
  }): Promise<GatewaySendResult>;
  peekInbound(
    limit?: number,
  ): Promise<{ messages: { uid: string; subject: string; from: string }[] }>;
  acknowledge(ids: string[]): Promise<{ acknowledged: number }>;
  preview(address: string): Promise<{ mapped: string; warnings: string[] }>;
}

export interface IDirectoryService {
  search(query: string): Promise<DirectoryEntry[]>;
  getEntry(id: string): Promise<DirectoryEntry | null>;
  getDistributionList(id: string): Promise<DistributionList | null>;
}

export type IReport = Report;

export interface ITlsSummary {
  enabled: boolean;
  minVersion: string;
  fingerprint?: string;
  fingerprintMatches: boolean;
  expiresAt?: string;
  error?: string;
  ocspResponderConfigured: boolean;
  revocationChecked: boolean;
  warnings: string[];
}

export interface IServiceStatus {
  transportMode: 'mock' | 'sdk';
  tls: ITlsSummary;
  smimeEnabled: boolean;
}

export interface IX400Transport {
  connect(): Promise<ISession>;
  folders: IFolderService;
  messages: IMessageService;
  trace: ITraceService;
  migration: IMigrationService;
  gateway: IGatewayService;
  directory: IDirectoryService;
  compose(payload: {
    sender: X400Address;
    recipients: X400Address[];
    subject: string;
    body: string;
  }): Promise<ISubmitResult>;
  status(): Promise<IServiceStatus>;
}

export type TransportFactory = (options?: TransportOptions) => IX400Transport;

export interface TransportOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  retries?: number;
  mode?: 'mock' | 'sdk';
  inlineExecution?: boolean;
}
