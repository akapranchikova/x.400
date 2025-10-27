import {
  directoryEntrySchema,
  distributionListSchema,
  folderListSchema,
  gatewaySendResultSchema,
  inboundGatewayMessageSchema,
  messageContentSchema,
  messageEnvelopeSchema,
  messageSchema,
  migrationProgressSchema,
  migrationReportSchema,
  migrationRequestSchema,
  type DirectoryEntry,
  type Folder,
  type Message,
  type MessageEnvelope,
  type MigrationProgress,
  type MigrationReport,
  type MigrationRequest,
} from '@x400/shared';

import {
  inlineDirectoryEntries,
  inlineDistributionLists,
  inlineFolders,
  inlineMessages,
} from './inline-data';
import type {
  IDirectoryService,
  IGatewayService,
  IMigrationService,
  IMessageService,
  IServiceStatus,
  ISession,
  ISubmitResult,
  ITlsSummary,
  IX400Transport,
  TransportFactory,
} from './interfaces';

const clone = <T>(value: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

const now = () => new Date().toISOString();

const randomId = () =>
  typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto
    ? globalThis.crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const defaultTlsSummary: ITlsSummary = {
  enabled: false,
  minVersion: 'TLS1_3',
  fingerprint: undefined,
  fingerprintMatches: true,
  expiresAt: undefined,
  error: undefined,
  ocspResponderConfigured: false,
  revocationChecked: false,
  warnings: [],
};

const inlineStatus: IServiceStatus = {
  transportMode: 'mock',
  tls: defaultTlsSummary,
  smimeEnabled: false,
};

const toEnvelopeList = (messages: Iterable<Message>) => {
  return Array.from(messages, (message) => clone(message.envelope)).sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

const createSubmitResult = (message: MessageEnvelope): ISubmitResult => ({
  messageId: message.id,
  queueReference: `inline://queue/${message.id}`,
  status: 'queued',
  diagnosticCode: undefined,
});

const createGatewayResult = (messageId: string, recipients: string[]) =>
  gatewaySendResultSchema.parse({
    messageId,
    accepted: true,
    recipients,
    warnings: [],
  });

const sampleInboundMessages = inboundGatewayMessageSchema.array().parse([
  {
    uid: 'inline-1',
    subject: 'Pending delivery status',
    from: 'status@modernization.example',
    receivedAt: '2024-01-01T11:00:00.000Z',
  },
]);

const migrationJobs = new Map<string, { progress: MigrationProgress; report: MigrationReport }>();

export const createInlineTransport: TransportFactory = (_options) => {
  const folderState = new Map<Folder['id'], Folder>(
    folderListSchema.parse(inlineFolders).map((folder) => [folder.id, clone(folder)]),
  );
  const messageState = new Map<string, Message>();
  const directoryState = new Map<string, DirectoryEntry>();
  const distributionState = new Map(
    inlineDistributionLists.map((entry) => [entry.id, clone(entry)]),
  );

  for (const entry of directoryEntrySchema.array().parse(inlineDirectoryEntries)) {
    directoryState.set(entry.id, clone(entry));
  }

  for (const message of messageSchema.array().parse(inlineMessages)) {
    messageState.set(message.envelope.id, clone(message));
  }

  const updateUnreadCounts = () => {
    for (const folder of folderState.values()) {
      folder.unreadCount = 0;
    }
    for (const message of messageState.values()) {
      const folder = folderState.get(message.envelope.folder);
      if (folder && message.envelope.status !== 'read') {
        folder.unreadCount += 1;
      }
    }
  };

  updateUnreadCounts();

  const folders = {
    async listFolders() {
      updateUnreadCounts();
      return Array.from(folderState.values()).map((folder) => clone(folder));
    },
  } satisfies { listFolders: () => Promise<Folder[]> };

  const messages: IMessageService = {
    async listMessages(folderId) {
      const filtered = Array.from(messageState.values()).filter(
        (entry) => entry.envelope.folder === folderId,
      );
      return toEnvelopeList(filtered);
    },
    async getMessage(messageId) {
      const message = messageState.get(messageId);
      if (!message) {
        throw new Error(`Message ${messageId} not found`);
      }
      return clone(message);
    },
    async submitMessage(envelope, content) {
      const nowTs = now();
      const id = envelope.id ?? randomId();
      const parsedEnvelope = messageEnvelopeSchema.parse({
        ...envelope,
        id,
        folder: envelope.folder ?? 'outbox',
        status: envelope.status ?? 'queued',
        createdAt: envelope.createdAt ?? nowTs,
        updatedAt: envelope.updatedAt ?? nowTs,
        messageId: envelope.messageId ?? `<${id}@inline.x400>`,
      });
      const parsedContent = messageContentSchema.parse(content);
      const item: Message = {
        envelope: parsedEnvelope,
        content: parsedContent,
        reports: [],
      };
      messageState.set(item.envelope.id, item);
      updateUnreadCounts();
      return createSubmitResult(item.envelope);
    },
    async deleteMessage(messageId) {
      messageState.delete(messageId);
      updateUnreadCounts();
    },
    async moveMessage(messageId, folderId) {
      const message = messageState.get(messageId);
      if (!message) {
        throw new Error(`Message ${messageId} not found`);
      }
      message.envelope.folder = folderId as MessageEnvelope['folder'];
      message.envelope.updatedAt = now();
      updateUnreadCounts();
    },
    async archiveMessage(messageId) {
      await this.moveMessage(messageId, 'archive');
    },
  };

  const trace = {
    async bundle() {
      return { entries: [{ event: 'inline.transport', payload: { status: 'ok' } }] };
    },
  } satisfies { bundle: () => Promise<{ entries: unknown[] }> };

  const migration: IMigrationService = {
    async import(request) {
      const parsed = migrationRequestSchema.parse(request);
      const jobId = randomId();
      const startedAt = now();
      const finishedAt = startedAt;
      const progress = migrationProgressSchema.parse({
        jobId,
        status: 'completed',
        total: 1,
        processed: 1,
        imported: parsed.dryRun ? 0 : 1,
        failed: 0,
        duplicates: 0,
        dryRun: Boolean(parsed.dryRun),
        checksumOk: true,
        startedAt,
        finishedAt,
        currentPath: parsed.path,
        notes: parsed.dryRun
          ? ['Dry-run only – inline transport did not import messages']
          : ['Inline transport processed example payload'],
      });
      const report = migrationReportSchema.parse({
        jobId,
        startedAt,
        finishedAt,
        total: 1,
        imported: parsed.dryRun ? 0 : 1,
        failed: 0,
        duplicates: 0,
        dryRun: Boolean(parsed.dryRun),
        checksumOk: true,
        notes: parsed.dryRun
          ? ['Dry-run completed successfully']
          : ['Example payload imported via inline transport'],
        errors: [],
      });
      migrationJobs.set(jobId, { progress, report });
      return { jobId };
    },
    async progress(jobId) {
      const entry = migrationJobs.get(jobId);
      if (!entry) {
        throw new Error(`Unknown migration job: ${jobId}`);
      }
      return clone(entry.progress);
    },
    async report(jobId) {
      const entry = migrationJobs.get(jobId);
      if (!entry) {
        throw new Error(`Unknown migration job: ${jobId}`);
      }
      return clone(entry.report);
    },
  };

  const compose = async (payload: {
    sender: MessageEnvelope['sender'];
    recipients: MessageEnvelope['to'];
    subject: string;
    body: string;
  }) => {
    const id = randomId();
    const timestamp = now();
    const envelope = messageEnvelopeSchema.parse({
      id,
      subject: payload.subject,
      sender: payload.sender,
      to: payload.recipients,
      cc: [],
      bcc: [],
      priority: 'normal',
      sensitivity: 'normal',
      folder: 'inbox',
      status: 'queued',
      createdAt: timestamp,
      updatedAt: timestamp,
      messageId: `<${id}@inline.x400>`,
    });
    const message: Message = {
      envelope,
      content: { text: payload.body, attachments: [] },
      reports: [],
    };
    messageState.set(envelope.id, message);
    updateUnreadCounts();
    return createSubmitResult(envelope);
  };

  const gateway: IGatewayService = {
    async send(payload) {
      const id = randomId();
      return createGatewayResult(id, payload.to);
    },
    async peekInbound(limit) {
      const messages = limit ? sampleInboundMessages.slice(0, limit) : sampleInboundMessages;
      return { messages: clone(messages) };
    },
    async acknowledge(ids) {
      return { acknowledged: ids.length };
    },
    async preview(address) {
      const trimmed = address.trim();
      const warnings: string[] = [];
      if (!trimmed.includes('@')) {
        warnings.push(
          'Address does not include a domain – inline mapping may differ from production',
        );
      }
      return { mapped: trimmed.toLowerCase(), warnings };
    },
  };

  const directory: IDirectoryService = {
    async search(query) {
      const term = query.trim().toLowerCase();
      if (!term) {
        return Array.from(directoryState.values()).map((entry) => clone(entry));
      }
      return Array.from(directoryState.values())
        .filter((entry) => {
          return (
            entry.displayName.toLowerCase().includes(term) ||
            entry.rfc822.toLowerCase().includes(term) ||
            entry.orAddress.toLowerCase().includes(term)
          );
        })
        .map((entry) => clone(entry));
    },
    async getEntry(id) {
      const entry = directoryState.get(id);
      return entry ? clone(entry) : null;
    },
    async getDistributionList(id) {
      const list = distributionState.get(id);
      return list ? distributionListSchema.parse(clone(list)) : null;
    },
  };

  return {
    async connect(): Promise<ISession> {
      return {
        sessionId: randomId(),
        connectedAt: now(),
        peer: 'inline://transport',
      };
    },
    folders,
    messages,
    trace,
    migration,
    gateway,
    directory,
    compose,
    async status() {
      return clone(inlineStatus);
    },
  } satisfies IX400Transport;
};
