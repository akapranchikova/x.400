import { useEffect, useMemo, useState } from 'react';

import type { IServiceStatus } from '@x400/sdk-wrapper';
import JSZip from 'jszip';

import { getTransport } from '../lib/transport';

interface DiagnosticsPanelProps {
  open: boolean;
  onClose: () => void;
  status: IServiceStatus | null;
  sessionPeer: string | null;
  onSnapshot?: (available: boolean) => void;
}

type TelemetryEvent = {
  flow: string;
  latency_ms: number;
  success: boolean;
  timestamp: number;
};

type TelemetryMetrics = {
  messages_sent: number;
  total_latency_ms: number;
  latency_samples: number;
  queue_depth: number;
  error_count: number;
};

type TelemetrySnapshot = {
  metrics: TelemetryMetrics;
  average_latency_ms: number;
  events: TelemetryEvent[];
  last_errors: string[];
};

const resolveJaegerUrl = (): string | null => {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
  if (metaEnv?.VITE_JAEGER_URL) {
    return metaEnv.VITE_JAEGER_URL;
  }
  if (typeof process !== 'undefined' && process.env?.VITE_JAEGER_URL) {
    return process.env.VITE_JAEGER_URL;
  }
  return null;
};

const fetchSnapshot = async (baseUrl: string | null): Promise<TelemetrySnapshot | null> => {
  if (!baseUrl) return null;
  try {
    const snapshotUrl = new URL('/telemetry/snapshot.json', baseUrl).toString();
    const response = await fetch(snapshotUrl, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as TelemetrySnapshot;
  } catch (error) {
    console.warn('Failed to fetch telemetry snapshot', error);
    return null;
  }
};

export const DiagnosticsPanel = ({
  open,
  onClose,
  status,
  sessionPeer,
  onSnapshot,
}: DiagnosticsPanelProps) => {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const jaegerUrl = resolveJaegerUrl();

  useEffect(() => {
    if (!open) {
      return;
    }
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const transport = getTransport();
        const [bundle, telemetry] = await Promise.all([
          transport.trace
            .bundle()
            .then((data) => (Array.isArray(data?.entries) ? data.entries : []))
            .catch((reason) => {
              console.warn('Failed to load trace bundle', reason);
              return [];
            }),
          fetchSnapshot(sessionPeer),
        ]);
        if (!mounted) return;
        setSnapshot(telemetry);
        onSnapshot?.(Boolean(telemetry));
        setEvents(bundle.slice(-25) as TelemetryEvent[]);
      } catch (loadError) {
        console.error(loadError);
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load diagnostics');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [open, sessionPeer]);

  const systemInfo = useMemo(() => {
    return [
      {
        label: 'User agent',
        value: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      },
      { label: 'Platform', value: typeof navigator !== 'undefined' ? navigator.platform : 'N/A' },
      { label: 'IPC endpoint', value: sessionPeer ?? 'unknown' },
      { label: 'Transport mode', value: status?.transportMode ?? 'unknown' },
      {
        label: 'TLS',
        value: status
          ? `${status.tls.minVersion} (${status.tls.enabled ? 'enabled' : 'disabled'})`
          : 'n/a',
      },
    ];
  }, [sessionPeer, status]);

  const uploadTrace = async () => {
    if (uploading) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const transport = getTransport();
      const bundle = await transport.trace
        .bundle()
        .then((data) => (Array.isArray(data?.entries) ? data.entries : []))
        .catch(() => []);
      const telemetry = snapshot ?? (await fetchSnapshot(sessionPeer));
      const zip = new JSZip();
      const metadata = {
        createdAt: new Date().toISOString(),
        sessionPeer,
        systemInfo,
        status,
        telemetryAvailable: Boolean(telemetry),
      };
      zip.file('metadata.json', JSON.stringify(metadata, null, 2));
      zip.file('trace.json', JSON.stringify(bundle, null, 2));
      if (telemetry) {
        zip.file('snapshot.json', JSON.stringify(telemetry, null, 2));
      }
      const archive = await zip.generateAsync({ type: 'arraybuffer' });
      const baseUrl = sessionPeer ?? 'http://127.0.0.1:3333';
      const endpoint = new URL('/support/upload', baseUrl).toString();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/zip',
          'x-support-channel': 'ui',
        },
        body: archive,
      });
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      setUploadResult(`Trace bundle uploaded to ${endpoint}`);
    } catch (uploadError) {
      console.error(uploadError);
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload diagnostics');
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Diagnostics and Support</h2>
            <p className="text-sm text-slate-500">
              Inspect telemetry status, recent trace events, and upload bundles for support teams.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <div className="flex flex-col gap-6 overflow-y-auto px-6 py-6">
          {loading && <p className="text-sm text-slate-500">Loading diagnostics…</p>}
          {error && (
            <p
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
          <section aria-label="System information" className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">System</h3>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {systemInfo.map((item) => (
                <li
                  key={item.label}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
                >
                  <span className="block text-xs font-semibold uppercase text-slate-400">
                    {item.label}
                  </span>
                  <span className="block break-words text-slate-700">
                    {item.value ?? 'Unknown'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="Telemetry status" className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Telemetry
            </h3>
            {snapshot ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                <p>Telemetry is enabled and capturing data locally.</p>
                <ul className="mt-2 grid grid-cols-2 gap-2 text-xs text-emerald-900 sm:grid-cols-4">
                  <li>Messages sent: {snapshot.metrics.messages_sent}</li>
                  <li>Errors: {snapshot.metrics.error_count}</li>
                  <li>Queue depth: {snapshot.metrics.queue_depth}</li>
                  <li>Avg latency: {snapshot.average_latency_ms.toFixed(2)} ms</li>
                </ul>
              </div>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                No telemetry snapshot is available. Ensure telemetry is enabled in the core service
                configuration.
              </p>
            )}
            {snapshot?.last_errors?.length ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                <p className="font-medium">Recent errors</p>
                <ul className="mt-2 space-y-1 text-xs text-amber-900">
                  {snapshot.last_errors.slice(-5).map((item, index) => (
                    <li key={`${item}-${index}`} className="truncate" title={item}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
          <section aria-label="Recent events" className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Recent trace events
            </h3>
            {events.length === 0 ? (
              <p className="text-sm text-slate-500">No trace events were recorded.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-slate-500">Flow</th>
                      <th className="px-3 py-2 font-semibold text-slate-500">Latency</th>
                      <th className="px-3 py-2 font-semibold text-slate-500">Status</th>
                      <th className="px-3 py-2 font-semibold text-slate-500">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map((event, index) => (
                      <tr
                        key={`${event.flow}-${event.timestamp}-${index}`}
                        className="odd:bg-white even:bg-slate-50"
                      >
                        <td className="px-3 py-2 font-medium text-slate-700">{event.flow}</td>
                        <td className="px-3 py-2 text-slate-600">{event.latency_ms} ms</td>
                        <td className="px-3 py-2 text-slate-600">
                          {event.success ? 'success' : 'error'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {new Date(event.timestamp ?? Date.now()).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={uploadTrace}
                disabled={uploading}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {uploading ? 'Uploading…' : 'Send trace to support'}
              </button>
              {jaegerUrl ? (
                <a
                  href={jaegerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                >
                  View traces
                </a>
              ) : null}
            </div>
            {uploadResult && <p className="text-sm text-emerald-600">{uploadResult}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
