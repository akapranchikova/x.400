import { FormEvent, useState } from 'react';

type AdvancedSearchValues = {
  from: string;
  to: string;
  status: string;
  startDate: string;
  endDate: string;
  attachmentsOnly: boolean;
};

interface AdvancedSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (values: AdvancedSearchValues) => void;
}

const DEFAULT_VALUES: AdvancedSearchValues = {
  from: '',
  to: '',
  status: 'any',
  startDate: '',
  endDate: '',
  attachmentsOnly: false,
};

export const AdvancedSearchDialog = ({ open, onClose, onApply }: AdvancedSearchDialogProps) => {
  const [values, setValues] = useState<AdvancedSearchValues>(DEFAULT_VALUES);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply(values);
    onClose();
  };

  const update = <K extends keyof AdvancedSearchValues>(key: K, value: AdvancedSearchValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
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
        <header>
          <h2 className="text-lg font-semibold text-slate-800">Advanced search</h2>
          <p className="text-xs text-slate-500">
            Narrow down messages by participants, time range, and metadata. Keyboard shortcut:
            Ctrl+F.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-600">
            From
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              value={values.from}
              onChange={(event) => update('from', event.target.value)}
              placeholder="alice@example.com"
            />
          </label>
          <label className="block text-sm font-medium text-slate-600">
            To
            <input
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              value={values.to}
              onChange={(event) => update('to', event.target.value)}
              placeholder="operations@org"
            />
          </label>
          <label className="block text-sm font-medium text-slate-600">
            Start date
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              value={values.startDate}
              onChange={(event) => update('startDate', event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-slate-600">
            End date
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              value={values.endDate}
              onChange={(event) => update('endDate', event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-slate-600">
            Status
            <select
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
              value={values.status}
              onChange={(event) =>
                update('status', event.target.value as AdvancedSearchValues['status'])
              }
            >
              <option value="any">Any</option>
              <option value="queued">Queued</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={values.attachmentsOnly}
              onChange={(event) => update('attachmentsOnly', event.target.checked)}
            />
            Attachments only
          </label>
        </div>

        <footer className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm"
            onClick={() => {
              setValues(DEFAULT_VALUES);
              onClose();
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Apply filters
          </button>
        </footer>
      </form>
    </div>
  );
};
