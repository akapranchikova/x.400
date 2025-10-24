import type { IServiceStatus } from '@x400/sdk-wrapper';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  status: IServiceStatus | null;
}

const formatTls = (status: IServiceStatus | null) => {
  if (!status?.tls.enabled) return 'TLS disabled (development)';
  if (status.tls.error) return `TLS error: ${status.tls.error}`;
  if (status.tls.warnings.length > 0) {
    return `TLS ${status.tls.minVersion} (${status.tls.warnings.join('; ')})`;
  }
  return `TLS ${status.tls.minVersion}`;
};

export const SettingsPanel = ({ open, onClose, status }: SettingsPanelProps) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl space-y-6">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-1 text-sm"
          >
            Close
          </button>
        </header>

        <section>
          <h3 className="text-sm font-semibold text-slate-700">Connection profile</h3>
          <div className="mt-2 grid grid-cols-1 gap-3 text-sm text-slate-600 md:grid-cols-2">
            <label className="flex flex-col">
              Profile name
              <input
                className="mt-1 rounded-md border border-slate-200 px-3 py-2"
                defaultValue={status ? status.transportMode : 'mock'}
                readOnly
              />
            </label>
            <label className="flex flex-col">
              Host
              <input
                className="mt-1 rounded-md border border-slate-200 px-3 py-2"
                defaultValue="127.0.0.1"
              />
            </label>
            <label className="flex flex-col">
              Port
              <input
                className="mt-1 rounded-md border border-slate-200 px-3 py-2"
                defaultValue="7878"
              />
            </label>
            <label className="flex flex-col">
              TLS mode
              <input
                className="mt-1 rounded-md border border-slate-200 px-3 py-2"
                value={formatTls(status)}
                readOnly
              />
            </label>
            <label className="flex flex-col">
              Certificates
              <input
                className="mt-1 rounded-md border border-slate-200 px-3 py-2"
                defaultValue="profiles/certs"
                readOnly
              />
            </label>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-700">Storage</h3>
          <div className="mt-2 space-y-2 text-sm text-slate-600">
            <label className="flex flex-col">
              Path
              <input
                className="mt-1 rounded-md border border-slate-200 px-3 py-2"
                defaultValue="./data/x400.db"
              />
            </label>
            <p className="text-xs text-slate-500">
              SQLCipher encryption will be enabled in production builds. Keys are retrieved from the
              OS keychain.
            </p>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-700">Tracing</h3>
          <div className="mt-2 space-y-2 text-sm text-slate-600">
            <label className="flex flex-col">
              Level
              <select
                className="mt-1 rounded-md border border-slate-200 px-3 py-2"
                defaultValue="info"
              >
                <option value="error">Error</option>
                <option value="warn">Warn</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </label>
            <p className="text-xs text-slate-500">
              Trace bundles include sanitized metadata only. Use the CLI to export and attach to
              support tickets.
            </p>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-700">Security</h3>
          <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-xs uppercase text-slate-500">TLS fingerprint</p>
              <p className="break-all text-xs text-slate-700">
                {status?.tls.fingerprint ?? 'Not available'}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-xs uppercase text-slate-500">S/MIME</p>
              <p className="text-xs text-slate-700">
                {status?.smimeEnabled
                  ? 'Enabled for outgoing messages'
                  : 'Disabled in this profile'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
