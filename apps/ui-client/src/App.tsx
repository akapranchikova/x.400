import { useEffect, useMemo, useRef, useState } from 'react';

import { AdvancedSearchDialog } from './components/AdvancedSearchDialog';
import { ComposeDialog } from './components/ComposeDialog';
import { GatewayPreview } from './components/GatewayPreview';
import { FolderList } from './components/FolderList';
import { MessageDetail } from './components/MessageDetail';
import { MessageList } from './components/MessageList';
import { MigrationPanel } from './components/MigrationPanel';
import { SavedFiltersBar } from './components/SavedFiltersBar';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusBar } from './components/StatusBar';
import { useFolders } from './hooks/useFolders';
import { useMessages } from './hooks/useMessages';
import { getTransport } from './lib/transport';

import type { IServiceStatus } from '@x400/sdk-wrapper';
import type { Folder } from '@x400/shared';

const DEFAULT_FOLDER = 'inbox';

const FALLBACK_FOLDERS: Folder[] = [
  { id: 'inbox', name: 'Inbox', unreadCount: 0 },
  { id: 'outbox', name: 'Outbox', unreadCount: 0 },
  { id: 'failed', name: 'Failed', unreadCount: 0 },
  { id: 'archive', name: 'Archive', unreadCount: 0 },
  { id: 'followUp', name: 'Follow-up', unreadCount: 0 },
];

const MIGRATION_ENABLED =
  ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ENABLE_MIGRATION ??
    (typeof process !== 'undefined' ? process.env?.VITE_ENABLE_MIGRATION : undefined)) === 'true';

const App = () => {
  const [activeFolder, setActiveFolder] = useState(DEFAULT_FOLDER);
  const [composeOpen, setComposeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [serviceStatus, setServiceStatus] = useState<IServiceStatus | null>(null);
  const [savedFilters, setSavedFilters] = useState<{ id: string; label: string; query: string }[]>(
    [],
  );
  const [activeFilter, setActiveFilter] = useState<{
    id: string;
    label: string;
    query: string;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [gatewayMapping, setGatewayMapping] = useState<{
    input: string;
    mapped: string;
    warnings: string[];
  } | null>(null);
  const [directoryReady, setDirectoryReady] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

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

  const filteredMessages = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return messages.filter((message) => {
      const matchesTerm =
        !term ||
        message.subject.toLowerCase().includes(term) ||
        message.sender.orName.o?.toLowerCase().includes(term);
      const matchesFilter = !activeFilter || activeFilter.query.includes(message.subject);
      return matchesTerm && matchesFilter;
    });
  }, [messages, searchTerm, activeFilter]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setComposeOpen(true);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        setSettingsOpen(true);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setAdvancedOpen(true);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        void reload()
          .then(async () => {
            setLastSync(new Date());
            await refreshStatus();
          })
          .catch(console.error);
        return;
      }
      if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key.toLowerCase() === 'j') {
        event.preventDefault();
        if (!filteredMessages.length) return;
        const currentIndex = selected
          ? filteredMessages.findIndex((message) => message.id === selected.envelope.id)
          : -1;
        const next = filteredMessages[(currentIndex + 1) % filteredMessages.length];
        void selectMessage(next.id);
        return;
      }
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (!filteredMessages.length) return;
        const currentIndex = selected
          ? filteredMessages.findIndex((message) => message.id === selected.envelope.id)
          : 0;
        const next =
          filteredMessages[(currentIndex - 1 + filteredMessages.length) % filteredMessages.length];
        void selectMessage(next.id);
        return;
      }
      if (event.key.toLowerCase() === 'n' && !event.metaKey && !event.ctrlKey) {
        setComposeOpen(true);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredMessages, reload, selectMessage, selected]);

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

  const handleDirectoryAutocomplete = async (query: string) => {
    try {
      const transport = getTransport();
      const results = await transport.directory.search(query);
      setDirectoryReady(true);
      return results.slice(0, 5).map((entry) => `${entry.displayName} <${entry.rfc822}>`);
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const handleGatewayPreview = async (input: string) => {
    try {
      const transport = getTransport();
      const result = await transport.gateway.preview(input);
      setGatewayMapping({ input, mapped: result.mapped, warnings: result.warnings });
    } catch (err) {
      console.error(err);
      setGatewayMapping({ input, mapped: 'unavailable', warnings: ['Preview failed'] });
    }
  };

  const handleAdvancedApply = (values: {
    from: string;
    to: string;
    status: string;
    startDate: string;
    endDate: string;
    attachmentsOnly: boolean;
  }) => {
    const label = [values.from || 'Any sender', values.to || 'Any recipient']
      .filter(Boolean)
      .join(' → ');
    const entry = {
      id: `filter-${Date.now()}`,
      label,
      query: JSON.stringify(values),
    };
    setActiveFilter(entry);
    if (values.from || values.to) {
      setSearchTerm(values.from || values.to);
    }
  };

  const handleSaveFilter = () => {
    if (!searchTerm) return;
    const entry = {
      id: `saved-${Date.now()}`,
      label: searchTerm,
      query: searchTerm,
    };
    setSavedFilters((prev) => [entry, ...prev].slice(0, 6));
  };

  const statusMessage = useMemo(() => {
    if (error) return `Error: ${error}`;
    if (loading) return 'Syncing messages…';
    return `Viewing ${filteredMessages.length} message(s)`;
  }, [error, loading, filteredMessages.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100 p-6 text-slate-800">
      <div className="mx-auto flex h-[85vh] max-w-6xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">X.400 Client Modernization</h1>
            <p className="text-sm text-slate-500">{statusMessage}</p>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-600 md:flex">
              <span className="sr-only">Search</span>
              <input
                ref={searchRef}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-52 bg-transparent text-sm outline-none"
                placeholder="Quick search (/ to focus)"
              />
            </div>
            <button
              type="button"
              onClick={() => setAdvancedOpen(true)}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm"
            >
              Advanced (Ctrl+F)
            </button>
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow"
            >
              Compose (Ctrl+N)
            </button>
            {MIGRATION_ENABLED ? (
              <button
                type="button"
                onClick={() => setMigrationOpen(true)}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm"
              >
                Migration
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm"
            >
              Settings (Ctrl+,)
            </button>
          </div>
        </header>

        <SavedFiltersBar
          filters={savedFilters}
          onSelect={(filter) => {
            setActiveFilter(filter);
            setSearchTerm(filter.query);
          }}
          onSave={handleSaveFilter}
        />

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
            className="flex flex-col gap-3 overflow-hidden rounded-lg bg-transparent"
            aria-label="Message list"
          >
            <GatewayPreview mapping={gatewayMapping} onPreview={handleGatewayPreview} />
            <MessageList
              messages={filteredMessages}
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
          <StatusBar
            connected={connected}
            lastSync={lastSync}
            status={serviceStatus}
            gatewayMapping={gatewayMapping}
            directoryReady={directoryReady}
          />
        </footer>
      </div>

      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSubmit={handleComposeSubmit}
        onAutocomplete={handleDirectoryAutocomplete}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        status={serviceStatus}
      />
      <MigrationPanel open={migrationOpen} onClose={() => setMigrationOpen(false)} />
      <AdvancedSearchDialog
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        onApply={handleAdvancedApply}
      />
    </div>
  );
};

export default App;
