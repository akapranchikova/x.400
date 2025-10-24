import { FormEvent, useEffect, useMemo, useState } from 'react';

import { getTransport } from '../lib/transport';

import type { MigrationProgress, MigrationReport } from '@x400/shared';

type MigrationMode = 'auto' | 'fwm' | 'fwz';

type MigrationPanelProps = {
  open: boolean;
  onClose: () => void;
};

const DEFAULT_PROGRESS: MigrationProgress = {
  jobId: '',
  status: 'pending',
  total: 0,
  processed: 0,
  imported: 0,
  failed: 0,
  duplicates: 0,
  dryRun: true,
  checksumOk: true,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  notes: [],
};

export const MigrationPanel = ({ open, onClose }: MigrationPanelProps) => {
  const [path, setPath] = useState('');
  const [mode, setMode] = useState<MigrationMode>('auto');
  const [dryRun, setDryRun] = useState(true);
  const [resume, setResume] = useState('');
  const [limit, setLimit] = useState('');
  const [since, setSince] = useState('');
  const [quarantine, setQuarantine] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPath('');
      setMode('auto');
      setDryRun(true);
      setResume('');
      setLimit('');
      setSince('');
      setQuarantine('');
      setSubmitting(false);
      setError(null);
      setProgress(null);
      setReport(null);
      setJobId(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const transport = getTransport();
      const payload = {
        path,
        mode,
        dryRun,
        resume: resume.trim() ? resume.trim() : undefined,
        limit: limit ? Number.parseInt(limit, 10) : undefined,
        since: since.trim() ? since.trim() : undefined,
        quarantine: quarantine.trim() ? quarantine.trim() : undefined,
      } as const;

      const result = await transport.migration.import(payload);
      setJobId(result.jobId);

      let snapshot = await transport.migration.progress(result.jobId);
      setProgress(snapshot);

      while (snapshot.status === 'running' || snapshot.status === 'pending') {
        await new Promise((resolve) => setTimeout(resolve, 750));
        snapshot = await transport.migration.progress(result.jobId);
        setProgress(snapshot);
      }

      const summary = await transport.migration.report(result.jobId);
      setReport(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed to start');
    } finally {
      setSubmitting(false);
    }
  };

  const inProgress =
    submitting || (progress && progress.status !== 'completed' && progress.status !== 'failed');

  const summaryItems = useMemo(() => {
    const details = progress ?? DEFAULT_PROGRESS;
    return [
      { label: 'Processed', value: `${details.processed}/${details.total}` },
      { label: 'Imported', value: details.imported.toString() },
      { label: 'Failed', value: details.failed.toString() },
      { label: 'Duplicates', value: details.duplicates.toString() },
    ];
  }, [progress]);

  const exportReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify({ jobId, report, progress }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `migration-report-${jobId ?? 'latest'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl space-y-4 rounded-lg bg-white p-6 shadow-xl"
      >
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-800">Legacy migration</h2>
          <p className="text-xs text-slate-500">
            Import FileWork .FWM directories or .FWZ archives with dry-run, resume, and checksum
            validation support.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Source path
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              value={path}
              onChange={(event) => setPath(event.target.value)}
              required
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Mode
            <select
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              value={mode}
              onChange={(event) => setMode(event.target.value as MigrationMode)}
            >
              <option value="auto">Auto detect</option>
              <option value="fwm">FWM directory</option>
              <option value="fwz">FWZ archive</option>
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Resume job ID
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              value={resume}
              onChange={(event) => setResume(event.target.value)}
              placeholder="Optional"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Limit (messages)
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              placeholder="Optional"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Since (ISO timestamp)
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              value={since}
              onChange={(event) => setSince(event.target.value)}
              placeholder="2024-01-01T00:00:00Z"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Quarantine directory
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              value={quarantine}
              onChange={(event) => setQuarantine(event.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(event) => setDryRun(event.target.checked)}
            />
            Dry-run (no database writes)
          </label>
          {progress ? (
            <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
              Status: {progress.status}
            </span>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <section className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <h3 className="text-sm font-semibold text-slate-800">Progress</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            {summaryItems.map((item) => (
              <div key={item.label}>
                <dt className="text-xs uppercase text-slate-500">{item.label}</dt>
                <dd className="text-base font-medium text-slate-800">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {report ? (
          <section className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <h3 className="text-sm font-semibold">Latest report</h3>
            <p className="mt-1 text-sm">
              Imported {report.imported} of {report.total} items. Failures: {report.failed}.
            </p>
            {report.notes.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                {report.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <footer className="flex flex-wrap justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-200 px-4 py-2 text-sm"
              onClick={onClose}
              disabled={inProgress}
            >
              Close
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-4 py-2 text-sm"
              onClick={exportReport}
              disabled={!report}
            >
              Export report
            </button>
          </div>

          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow"
            disabled={submitting}
          >
            {submitting ? 'Processing…' : 'Start migration'}
          </button>
        </footer>
      </form>
    </div>
  );
};
