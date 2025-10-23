import { useEffect, useMemo, useState } from 'react';

import { ComposeDialog } from './components/ComposeDialog';
import { FolderList } from './components/FolderList';
import { MessageDetail } from './components/MessageDetail';
import { MessageList } from './components/MessageList';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusBar } from './components/StatusBar';
import { useFolders } from './hooks/useFolders';
import { useMessages } from './hooks/useMessages';
import { getTransport } from './lib/transport';

const DEFAULT_FOLDER = 'inbox';

const App = () => {
  const [activeFolder, setActiveFolder] = useState(DEFAULT_FOLDER);
  const [composeOpen, setComposeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const { folders, loading: foldersLoading } = useFolders();
  const { messages, selected, loading, error, selectMessage, reload, submitMessage } =
    useMessages(activeFolder);

  useEffect(() => {
    const init = async () => {
      try {
        await getTransport().connect();
        setConnected(true);
        setLastSync(new Date());
      } catch (err) {
        console.error(err);
        setConnected(false);
      }
    };

    void init();
  }, []);

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
        void reload().then(() => setLastSync(new Date()));
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [reload]);

  useEffect(() => {
    setLastSync(new Date());
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
            {foldersLoading ? (
              <div className="rounded-lg bg-white/70 p-4 text-sm text-slate-500">
                Loading folders…
              </div>
            ) : (
              <FolderList
                folders={folders}
                activeFolder={activeFolder}
                onSelect={(folder) => {
                  setActiveFolder(folder);
                  void reload();
                }}
              />
            )}
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
          <StatusBar connected={connected} lastSync={lastSync} />
        </footer>
      </div>

      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSubmit={handleComposeSubmit}
      />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default App;
