import type { IServiceStatus } from '@x400/sdk-wrapper';

interface StatusBarProps {
  connected: boolean;
  lastSync: Date | null;
  status: IServiceStatus | null;
  gatewayMapping: { input: string; mapped: string; warnings: string[] } | null;
  directoryReady: boolean;
}

const describeTls = (status: IServiceStatus | null) => {
  if (!status) return 'TLS: pending';
  if (!status.tls.enabled) return 'TLS: disabled';
  if (status.tls.error) return `TLS: ${status.tls.error}`;
  if (!status.tls.fingerprintMatches) return 'TLS: fingerprint mismatch';
  if (status.tls.warnings.length > 0) {
    return `TLS: ${status.tls.minVersion} (${status.tls.warnings[0]})`;
  }
  return `TLS: ${status.tls.minVersion}`;
};

export const StatusBar = ({
  connected,
  lastSync,
  status,
  gatewayMapping,
  directoryReady,
}: StatusBarProps) => {
  const modeLabel = status ? `Mode: ${status.transportMode.toUpperCase()}` : 'Mode: resolving…';
  const tlsLabel = describeTls(status);
  const smimeLabel = status?.smimeEnabled ? 'S/MIME: enabled' : 'S/MIME: disabled';
  const gatewayLabel = gatewayMapping
    ? `Gateway: ${gatewayMapping.mapped}`
    : 'Gateway: preview pending';
  const directoryLabel = directoryReady ? 'Directory cache: warm' : 'Directory cache: cold';

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-white/80 px-4 py-2 text-xs text-slate-600 shadow">
      <div className="flex flex-col gap-0.5" aria-live="polite">
        <span>{connected ? 'Connected to local IPC' : 'Disconnected'}</span>
        <span>{modeLabel}</span>
      </div>
      <div className="flex flex-col items-end gap-0.5 text-right">
        <span>{tlsLabel}</span>
        <span>{smimeLabel}</span>
        <span>{gatewayLabel}</span>
        <span>{directoryLabel}</span>
        <span>Last sync: {lastSync ? lastSync.toLocaleTimeString() : 'Waiting…'}</span>
      </div>
    </div>
  );
};
