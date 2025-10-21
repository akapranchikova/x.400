interface StatusBarProps {
  connected: boolean;
  lastSync: Date | null;
}

export const StatusBar = ({ connected, lastSync }: StatusBarProps) => {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/80 px-4 py-2 text-xs text-slate-600 shadow">
      <span aria-live="polite">
        {connected ? 'Connected to local IPC' : 'Disconnected'}
      </span>
      <span>
        Last sync: {lastSync ? lastSync.toLocaleTimeString() : 'Waiting…'}
      </span>
    </div>
  );
};
