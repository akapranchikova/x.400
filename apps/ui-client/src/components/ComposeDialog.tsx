import { FormEvent, useEffect, useMemo, useState } from 'react';

interface ComposeDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (subject: string, body: string, sender: string, recipients: string[]) => Promise<void>;
  onAutocomplete?: (query: string) => Promise<string[]>;
}

export const ComposeDialog = ({ open, onClose, onSubmit, onAutocomplete }: ComposeDialogProps) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sender, setSender] = useState('Modernization Unit');
  const [recipients, setRecipients] = useState('Operations Desk');
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const tokens = useMemo(
    () =>
      recipients
        .split(/[,;]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    [recipients],
  );

  useEffect(() => {
    const last = tokens[tokens.length - 1];
    if (!onAutocomplete || !last || last.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    onAutocomplete(last)
      .then((results) => {
        if (!cancelled) {
          setSuggestions(results);
        }
      })
      .catch(() => setSuggestions([]));
    return () => {
      cancelled = true;
    };
  }, [tokens, onAutocomplete]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    await onSubmit(subject, body, sender, tokens);
    setSubject('');
    setBody('');
    setSubmitting(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl space-y-4 rounded-lg bg-white p-6 shadow-xl"
      >
        <header>
          <h2 className="text-lg font-semibold text-slate-800">Compose message</h2>
          <p className="text-xs text-slate-500">Use Ctrl+Enter to send quickly.</p>
        </header>

        <label className="block text-sm font-medium text-slate-600">
          Subject
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            autoFocus
          />
        </label>

        <label className="block text-sm font-medium text-slate-600">
          Sender organization
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
            value={sender}
            onChange={(event) => setSender(event.target.value)}
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-600">
          Recipients (separated by commas)
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
            value={recipients}
            onChange={(event) => setRecipients(event.target.value)}
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
          />
          {suggestions.length > 0 ? (
            <ul
              className="mt-2 space-y-1 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600"
              role="listbox"
            >
              {suggestions.slice(0, 5).map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1 text-left transition hover:bg-blue-50"
                    onClick={() => {
                      const next = [...tokens.slice(0, -1), suggestion].join(', ');
                      setRecipients(next);
                      setSuggestions([]);
                    }}
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </label>

        <label className="block text-sm font-medium text-slate-600">
          Body
          <textarea
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2"
            rows={6}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow"
            disabled={submitting}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                (event.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }}
          >
            {submitting ? 'Sending…' : 'Send (Ctrl+Enter)'}
          </button>
        </div>
      </form>
    </div>
  );
};
