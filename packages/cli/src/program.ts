import { createWriteStream, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import {
  createTransport as createSdkAwareTransport,
  type TransportFactory,
} from '@x400/sdk-wrapper';
import { ENV, delay, migrationRequestSchema } from '@x400/shared';
import { Command } from 'commander';
import { green, yellow } from 'kleur/colors';
import { ZipFile } from 'yazl';

import { parseOrAddress, parseOrAddresses } from './utils';

type GlobalOptions = { baseUrl: string; profile: string; tlsVerify: boolean; mock: boolean };

type TransportInstance = ReturnType<TransportFactory>;

type Handler<T> = (context: {
  transport: TransportInstance;
  session: Awaited<ReturnType<TransportInstance['connect']>>;
}) => Promise<T>;

type ProgramFactoryOptions = {
  createTransport?: TransportFactory;
};

const fileExists = async (target: string) => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

export const buildProgram = ({
  createTransport: factory = createSdkAwareTransport,
}: ProgramFactoryOptions = {}) => {
  const program = new Command();

  const defaultBaseUrl = ENV.IPC_URL;

  program
    .name('x400-cli')
    .description('Modern replacement for FW_SI.EXE interacting with the local X.400 IPC service')
    .version('0.1.0')
    .option('--base-url <url>', 'Base URL of the local IPC endpoint', defaultBaseUrl)
    .option('--profile <name>', 'Connection profile name', ENV.CLI_DEFAULT_PROFILE)
    .option('--tls-verify', 'Fail if TLS validation reports issues', false)
    .option('--mock', 'Force mock transport even if SDK mode is enabled', false);

  const withTransport = async <T>(options: GlobalOptions, handler: Handler<T>) => {
    const transport = factory({
      baseUrl: options.baseUrl,
      mode: options.mock ? 'mock' : undefined,
    });
    const session = await transport.connect();
    return handler({ transport, session });
  };

  program
    .command('env')
    .description('Inspect resolved environment configuration')
    .option('--json', 'Output machine-readable JSON', false)
    .action((cmdOptions) => {
      const details = {
        mode: ENV.X400_MODE,
        ipc: ENV.IPC_URL,
        profile: ENV.CLI_DEFAULT_PROFILE,
      };

      if (cmdOptions.json) {
        console.log(JSON.stringify(details, null, 2));
        return;
      }

      console.log(`Mode: ${details.mode}`);
      console.log(`IPC: ${details.ipc}`);
      console.log(`Profile: ${details.profile}`);
    });

  program
    .command('list')
    .description('List folders or messages in a specific folder')
    .option('-f, --folder <id>', 'Folder identifier', 'inbox')
    .option('--folders', 'List all folders instead of folder contents')
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        if (cmdOptions.folders) {
          const folders = await transport.folders.listFolders();
          console.log(JSON.stringify(folders, null, 2));
          return;
        }

        const items = await transport.messages.listMessages(cmdOptions.folder);
        console.log(JSON.stringify(items, null, 2));
      });
    });

  program
    .command('access')
    .description('Access a message by identifier and print details')
    .requiredOption('-i, --id <messageId>', 'Message identifier')
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        const message = await transport.messages.getMessage(cmdOptions.id);
        console.log(JSON.stringify(message, null, 2));
      });
    });

  program
    .command('create')
    .description('Submit a message to the local delivery queue')
    .requiredOption('--from <address>', 'Originator address in O/R format (e.g. C=DE;O=Org;S=User)')
    .option('--to <address...>', 'Recipient addresses in O/R format', [])
    .option('--subject <subject>', 'Subject line', 'Modernized message')
    .option('--body <body>', 'Body text', 'This is a mock submission via the CLI.')
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        const result = await transport.compose({
          sender: parseOrAddress(cmdOptions.from),
          recipients: parseOrAddresses(cmdOptions.to),
          subject: cmdOptions.subject,
          body: cmdOptions.body,
        });

        console.log(green('Message submitted successfully'));
        console.log(JSON.stringify(result, null, 2));
      });
    });

  program
    .command('delete')
    .description('Delete a message from the local store')
    .requiredOption('-i, --id <messageId>', 'Message identifier')
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        await transport.messages.deleteMessage(cmdOptions.id);
        console.log(green(`Message ${cmdOptions.id} removed`));
      });
    });

  program
    .command('move')
    .description('Move a message to another folder')
    .requiredOption('-i, --id <messageId>', 'Message identifier')
    .requiredOption('-f, --folder <folderId>', 'Target folder')
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        await transport.messages.moveMessage(cmdOptions.id, cmdOptions.folder);
        console.log(green(`Message ${cmdOptions.id} moved to ${cmdOptions.folder}`));
      });
    });

  program
    .command('archive')
    .description('Archive a message and detach it from operational queues')
    .requiredOption('-i, --id <messageId>', 'Message identifier')
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        await transport.messages.archiveMessage(cmdOptions.id);
        console.log(green(`Message ${cmdOptions.id} archived`));
      });
    });

  program
    .command('wait')
    .description('Wait until the outbox queue is flushed or timeout occurs')
    .option('-t, --timeout <seconds>', 'Timeout in seconds', '60')
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      const timeout = Number.parseInt(cmdOptions.timeout, 10) * 1000;
      const deadline = Date.now() + timeout;

      await withTransport(options, async ({ transport }) => {
        while (Date.now() < deadline) {
          const queued = await transport.messages.listMessages('outbox');
          if (queued.length === 0) {
            console.log(green('Outbox is empty.'));
            return;
          }

          console.log(yellow(`Outbox contains ${queued.length} message(s). Waiting...`));
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        throw new Error('Timeout reached while waiting for outbox to drain.');
      });
    });

  program
    .command('message')
    .description('Show summary information for a message')
    .requiredOption('-i, --id <messageId>', 'Message identifier')
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        const message = await transport.messages.getMessage(cmdOptions.id);
        console.log(
          JSON.stringify(
            {
              id: message.envelope.id,
              subject: message.envelope.subject,
              status: message.envelope.status,
              folder: message.envelope.folder,
              recipientCount: message.envelope.to.length,
            },
            null,
            2,
          ),
        );
      });
    });

  const support = program.command('support').description('Support and diagnostics tooling');

  support
    .command('trace')
    .description('Collect telemetry and create a diagnostics bundle')
    .option('--output <file>', 'Output path for the bundle', 'support/trace-bundle.zip')
    .option('--telemetry-dir <path>', 'Telemetry directory', 'telemetry')
    .option('--endpoint <url>', 'Support upload endpoint')
    .option('--upload', 'Upload bundle to the support endpoint', false)
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      const telemetryDir = path.resolve(cmdOptions.telemetryDir ?? 'telemetry');
      const bundlePath = path.resolve(cmdOptions.output ?? 'support/trace-bundle.zip');

      await fs.mkdir(path.dirname(bundlePath), { recursive: true });

      const zip = new ZipFile();
      const metadata = {
        createdAt: new Date().toISOString(),
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        telemetryDir,
        cliVersion: program.version(),
        baseUrl: options.baseUrl,
      };
      zip.addBuffer(Buffer.from(JSON.stringify(metadata, null, 2)), 'metadata.json');

      const tracePath = path.join(telemetryDir, 'trace.jsonl');
      if (await fileExists(tracePath)) {
        zip.addFile(tracePath, 'trace.jsonl');
      }

      const snapshotPath = path.join(telemetryDir, 'snapshot.json');
      if (await fileExists(snapshotPath)) {
        zip.addFile(snapshotPath, 'snapshot.json');
      }

      const outputStream = createWriteStream(bundlePath);
      const piping = pipeline(zip.outputStream, outputStream);
      zip.end();
      await piping;

      console.log(green(`Diagnostics bundle written to ${bundlePath}`));

      if (cmdOptions.upload) {
        const endpoint =
          cmdOptions.endpoint ?? `${options.baseUrl.replace(/\/$/, '')}/support/upload`;
        const data = await fs.readFile(bundlePath);
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/zip',
            'x-support-channel': 'cli',
          },
          body: data,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to upload support bundle: ${response.status} ${response.statusText}`,
          );
        }

        console.log(green(`Bundle uploaded to ${endpoint}`));
      }
    });

  program
    .command('bind-test')
    .description('Verify SDK connectivity and transport readiness for the active profile')
    .action(async () => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport, session }) => {
        const status = await transport.status();
        console.log(
          JSON.stringify(
            {
              session,
              status,
              profile: options.profile,
            },
            null,
            2,
          ),
        );
      });
    });

  program
    .command('submit')
    .description('Submit a message using the configured transport mode')
    .requiredOption('--from <address>', 'Originator address in O/R format (e.g. C=DE;O=Org;S=User)')
    .option('--to <address...>', 'Recipient addresses in O/R format', [])
    .option('--subject <subject>', 'Subject line', 'Modernized message')
    .option('--body <body>', 'Body text', 'This is a transport submission.')
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        const result = await transport.compose({
          sender: parseOrAddress(cmdOptions.from),
          recipients: parseOrAddresses(cmdOptions.to),
          subject: cmdOptions.subject,
          body: cmdOptions.body,
        });

        console.log(green('Message submitted successfully via transport'));
        console.log(JSON.stringify(result, null, 2));
      });
    });

  program
    .command('health')
    .description('Inspect transport mode, TLS configuration, and S/MIME status')
    .action(async () => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport, session }) => {
        const status = await transport.status();
        if (options.tlsVerify && status.tls.enabled) {
          if (!status.tls.fingerprintMatches || status.tls.error) {
            throw new Error(`TLS validation failed: ${status.tls.error ?? 'fingerprint mismatch'}`);
          }
        }

        if (status.tls.warnings.length > 0) {
          status.tls.warnings.forEach((warning) => {
            console.warn(yellow(`TLS warning: ${warning}`));
          });
        }

        console.log(
          JSON.stringify(
            {
              session,
              status,
              profile: options.profile,
            },
            null,
            2,
          ),
        );
      });
    });

  program
    .command('migrate')
    .description('Import legacy FileWork artifacts (.FWM directories or .FWZ archives)')
    .requiredOption('-p, --path <path>', 'Path to the legacy workspace or archive')
    .option('-t, --type <mode>', 'Artifact type (auto|fwm|fwz)', 'auto')
    .option('-d, --dry-run', 'Parse inputs without persisting changes', false)
    .option('-r, --resume <jobId>', 'Resume a previously started migration job')
    .option('--limit <count>', 'Maximum number of messages to import')
    .option('--since <iso-date>', 'Only import messages created after the provided timestamp')
    .option('--quarantine <dir>', 'Directory to store quarantined artifacts')
    .option('--json', 'Emit machine-readable JSON summaries', false)
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        let limit: number | undefined;
        if (cmdOptions.limit !== undefined) {
          limit = Number.parseInt(cmdOptions.limit, 10);
          if (!Number.isInteger(limit) || (limit as number) <= 0) {
            throw new Error('Limit must be a positive integer');
          }
        }

        const request = migrationRequestSchema.parse({
          path: cmdOptions.path,
          mode: cmdOptions.type,
          dryRun: Boolean(cmdOptions.dryRun),
          resume: cmdOptions.resume ?? undefined,
          limit: limit ?? undefined,
          since: cmdOptions.since ?? undefined,
          quarantine: cmdOptions.quarantine ?? undefined,
        });

        const { jobId } = await transport.migration.import(request);

        let progress = await transport.migration.progress(jobId);
        const logProgress = () => {
          const payload = { jobId, progress };
          if (cmdOptions.json) {
            console.log(JSON.stringify({ type: 'progress', ...payload }, null, 2));
          } else {
            console.log(
              `Progress ${progress.processed}/${progress.total} imported=${progress.imported} failed=${progress.failed} [${progress.status}]`,
            );
          }
        };

        logProgress();

        while (progress.status === 'running' || progress.status === 'pending') {
          await delay(750);
          progress = await transport.migration.progress(jobId);
          logProgress();
        }

        const report = await transport.migration.report(jobId);

        if (cmdOptions.json) {
          console.log(JSON.stringify({ type: 'report', jobId, report }, null, 2));
        } else {
          console.log('Migration completed');
          console.log(JSON.stringify(report, null, 2));
        }

        if (report.failed > 0) {
          console.error(
            JSON.stringify(
              {
                error: 'migration-failed',
                message: 'One or more artifacts failed to import',
                jobId,
                failed: report.failed,
              },
              null,
              2,
            ),
          );
          process.exitCode = 2;
        }
      });
    });

  const gateway = program.command('gateway').description('Interact with SMTP/IMAP gateway');

  gateway
    .command('send')
    .description('Send a message through the SMTP gateway adapter')
    .requiredOption('--to <email...>', 'Recipient RFC822 addresses')
    .requiredOption('--subject <subject>', 'Subject line for the message')
    .option('--body <body>', 'Message body', '')
    .option('--from <address>', 'Optional envelope sender address')
    .option('--json', 'Emit JSON output', false)
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        const result = await transport.gateway.send({
          to: Array.isArray(cmdOptions.to) ? cmdOptions.to : [cmdOptions.to],
          subject: cmdOptions.subject,
          body: cmdOptions.body,
          from: cmdOptions.from,
        });
        if (cmdOptions.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        console.log(green(`Gateway accepted message ${result.messageId}`));
        if (result.warnings.length) {
          console.log(yellow(result.warnings.join('\n')));
        }
      });
    });

  gateway
    .command('inbound')
    .description('Peek inbound messages from the gateway mailbox')
    .option('--limit <count>', 'Maximum number of messages to return', (value) => Number(value), 10)
    .option('--json', 'Emit JSON output', false)
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        const peek = await transport.gateway.peekInbound(cmdOptions.limit);
        if (cmdOptions.json) {
          console.log(JSON.stringify(peek, null, 2));
          return;
        }
        if (!peek.messages.length) {
          console.log('No inbound messages available.');
          return;
        }
        for (const message of peek.messages) {
          console.log(`[#${message.uid}] ${message.subject} ← ${message.from}`);
        }
      });
    });

  gateway
    .command('ack')
    .description('Acknowledge inbound messages after processing')
    .option('--ids <ids...>', 'Message identifiers to acknowledge', [])
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        const ids: string[] = Array.isArray(cmdOptions.ids) ? cmdOptions.ids : [cmdOptions.ids];
        const response = await transport.gateway.acknowledge(ids.filter(Boolean));
        console.log(green(`Acknowledged ${response.acknowledged} message(s)`));
      });
    });

  const directory = program.command('directory').description('Search the organisation directory');

  directory
    .command('search')
    .description('Search for entries by display name or address')
    .requiredOption('--query <value>', 'Search query')
    .option('--json', 'Emit JSON output', false)
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        const results = await transport.directory.search(cmdOptions.query);
        if (cmdOptions.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }
        if (!results.length) {
          console.log('No directory entries matched the query.');
          return;
        }
        results.forEach((entry) => {
          console.log(`${entry.displayName} <${entry.rfc822}> (${entry.orAddress})`);
        });
      });
    });

  directory
    .command('entry')
    .description('Fetch a directory entry by identifier')
    .requiredOption('--id <id>', 'Directory entry identifier')
    .option('--json', 'Emit JSON output', false)
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        const entry = await transport.directory.getEntry(cmdOptions.id);
        if (!entry) {
          console.log(yellow('Entry not found.'));
          return;
        }
        if (cmdOptions.json) {
          console.log(JSON.stringify(entry, null, 2));
          return;
        }
        console.log(`${entry.displayName} <${entry.rfc822}>`);
        console.log(entry.orAddress);
      });
    });

  directory
    .command('dl')
    .description('Inspect a distribution list by identifier')
    .requiredOption('--id <id>', 'Distribution list identifier')
    .option('--json', 'Emit JSON output', false)
    .action(async (cmdOptions) => {
      const options = program.opts<GlobalOptions>();
      await withTransport(options, async ({ transport }) => {
        const list = await transport.directory.getDistributionList(cmdOptions.id);
        if (!list) {
          console.log(yellow('Distribution list not found.'));
          return;
        }
        if (cmdOptions.json) {
          console.log(JSON.stringify(list, null, 2));
          return;
        }
        console.log(`${list.name} [${list.id}]`);
        list.members.forEach((member) => console.log(` - ${member}`));
      });
    });

  program.addHelpText(
    'afterAll',
    `\nFW_SI compatibility matrix:\n  list          -> LIST\n  access        -> ACCESS\n  create/submit -> CREATE\n  delete        -> DELETE\n  move          -> MOVE\n  archive       -> ARCHIVE\n  wait          -> WAIT\n  message       -> MESSAGE\n  migrate       -> IMPORT (new dry-run/resume options)\n`,
  );

  return program;
};
