import { useEffect, useMemo, useState } from 'react';

import type { IServiceStatus } from '@x400/sdk-wrapper';

import { ComposeDialog } from './components/ComposeDialog';
import { FolderList } from './components/FolderList';
import { MessageDetail } from './components/MessageDetail';
import { MessageList } from './components/MessageList';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusBar } from './components/StatusBar';
import { useFolders } from './hooks/useFolders';
import { useMessages } from './hooks/useMessages';
import { getTransport } from './lib/transport';

import type { Folder } from '@x400/shared';

const DEFAULT_FOLDER = 'inbox';

const FALLBACK_FOLDERS: Folder[] = [
  { id: 'inbox', name: 'Inbox', unreadCount: 0 },
  { id: 'outbox', name: 'Outbox', unreadCount: 0 },
  { id: 'failed', name: 'Failed', unreadCount: 0 },
  { id: 'archive', name: 'Archive', unreadCount: 0 },
  { id: 'followUp', name: 'Follow-up', unreadCount: 0 },
];

const App = () => {
  const [activeFolder, setActiveFolder] = useState(DEFAULT_FOLDER);
  const [composeOpen, setComposeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [serviceStatus, setServiceStatus] = useState<IServiceStatus | null>(null);

  const { folders, loading: foldersLoading } = useFolders();
  const { messages, selected, loading, error, selectMessage, reload, submitMessage } =
    useMessages(activeFolder);

  useEffect(() => {
    const init = async () => {
      try {
        const transport = getTransport();
        await transport.connect();
        setConnected(true);
        setLastSync(new Date());
        try {
          const status = await transport.status();
          setServiceStatus(status);
        } catch (statusError) {
          console.error(statusError);
        }
      } catch (err) {
        console.error(err);
        setConnected(false);
        setServiceStatus(null);
      }
    };

    void init();
  }, []);

  const refreshStatus = async () => {
    try {
      const status = await getTransport().status();
      setServiceStatus(status);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setComposeOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        setSettingsOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        void reload()
          .then(async () => {
            setLastSync(new Date());
            await refreshStatus();
          })
          .catch(console.error);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [reload]);

  useEffect(() => {
    setLastSync(new Date());
    void refreshStatus();
  }, [messages.length]);

  const handleComposeSubmit = async (
    subject: string,
    body: string,
    sender: string,
    recipients: string[],
  ) => {
    await submitMessage(subject, body, sender, recipients);
    setComposeOpen(false);
    setLastSync(new Date());
    await refreshStatus();
  };

  const statusMessage = useMemo(() => {
    if (error) return `Error: ${error}`;
    if (loading) return 'Syncing messages…';
    return `Viewing ${messages.length} message(s)`;
  }, [error, loading, messages.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100 p-6 text-slate-800">
      <div className="mx-auto flex h-[85vh] max-w-6xl flex-col gap-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">X.400 Client Modernization</h1>
            <p className="text-sm text-slate-500">{statusMessage}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow"
            >
              Compose (Ctrl+N)
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm"
            >
              Settings (Ctrl+,)
            </button>
          </div>
        </header>

        <main className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-[240px_minmax(300px,400px)_1fr]">
          <section aria-label="Folder list">
            <FolderList
              folders={folders.length ? folders : FALLBACK_FOLDERS}
              activeFolder={activeFolder}
              onSelect={(folder) => {
                if (foldersLoading && !folders.length) {
                  return;
                }
                setActiveFolder(folder);
                void reload();
              }}
              disabled={foldersLoading && !folders.length}
            />
          </section>

          <section
            className="flex flex-col overflow-hidden rounded-lg bg-white/80 shadow"
            aria-label="Message list"
          >
            <MessageList
              messages={messages}
              selectedId={selected?.envelope.id ?? null}
              onSelect={(id) => {
                void selectMessage(id);
              }}
              loading={loading}
            />
          </section>

          <section className="rounded-lg bg-white/90 shadow">
            <MessageDetail message={selected} />
          </section>
        </main>

        <footer>
          <StatusBar connected={connected} lastSync={lastSync} status={serviceStatus} />
        </footer>
      </div>

      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSubmit={handleComposeSubmit}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        status={serviceStatus}
      />
    </div>
  );
};

export default App;
