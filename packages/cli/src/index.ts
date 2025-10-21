#!/usr/bin/env node
import { Command } from 'commander';
import { createMockTransport } from '@x400/sdk-wrapper';
import { parseOrAddress, parseOrAddresses } from './utils';
import { green, yellow } from 'kleur/colors';

const program = new Command();

program
  .name('x400-cli')
  .description('Modern replacement for FW_SI.EXE interacting with the local X.400 IPC service')
  .version('0.1.0')
  .option('--base-url <url>', 'Base URL of the local IPC endpoint', 'http://127.0.0.1:7878');

type GlobalOptions = { baseUrl: string };
type TransportInstance = ReturnType<typeof createMockTransport>;

const withTransport = async <T>(options: GlobalOptions, handler: (transport: TransportInstance) => Promise<T>) => {
  const transport = createMockTransport({ baseUrl: options.baseUrl });
  await transport.connect();
  return handler(transport);
};

program
  .command('list')
  .description('List folders or messages in a specific folder')
  .option('-f, --folder <id>', 'Folder identifier', 'inbox')
  .option('--folders', 'List all folders instead of folder contents')
  .action(async (cmdOptions) => {
    const options = program.opts<GlobalOptions>();
    await withTransport(options, async (transport) => {
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
    await withTransport(options, async (transport) => {
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
    await withTransport(options, async (transport) => {
      const result = await transport.compose({
        sender: parseOrAddress(cmdOptions.from),
        recipients: parseOrAddresses(cmdOptions.to),
        subject: cmdOptions.subject,
        body: cmdOptions.body
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
    await withTransport(options, async (transport) => {
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
    await withTransport(options, async (transport) => {
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
    await withTransport(options, async (transport) => {
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

    await withTransport(options, async (transport) => {
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
    await withTransport(options, async (transport) => {
      const message = await transport.messages.getMessage(cmdOptions.id);
      console.log(JSON.stringify({
        id: message.envelope.id,
        subject: message.envelope.subject,
        status: message.envelope.status,
        folder: message.envelope.folder,
        recipientCount: message.envelope.to.length
      }, null, 2));
    });
  });

program.parseAsync(process.argv);
