import { FormEvent, useState } from 'react';

interface ComposeDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (subject: string, body: string, sender: string, recipients: string[]) => Promise<void>;
}

export const ComposeDialog = ({ open, onClose, onSubmit }: ComposeDialogProps) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sender, setSender] = useState('Modernization Unit');
  const [recipients, setRecipients] = useState('Operations Desk');
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    await onSubmit(subject, body, sender, recipients.split(/[,;]+/).map((value) => value.trim()).filter(Boolean));
    setSubject('');
    setBody('');
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl space-y-4"
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
          />
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
          >
            {submitting ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
};
