import type { Message } from '@x400/shared';

interface MessageDetailProps {
  message: Message | null;
}

export const MessageDetail = ({ message }: MessageDetailProps) => {
  if (!message) {
    return <div className="p-6 text-sm text-slate-500">Select a message to view details.</div>;
  }

  const { envelope, content, reports } = message;

  return (
    <article className="h-full overflow-auto p-6" aria-label="Message details">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">{envelope.status}</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-800">{envelope.subject}</h1>
        <p className="mt-2 text-sm text-slate-600">
          From {envelope.sender.orName.o ?? 'Unknown'} • To {envelope.to.length} recipient(s)
        </p>
        <p className="mt-1 text-xs text-slate-500">Created {new Date(envelope.createdAt).toLocaleString()}</p>
      </header>

      <section className="mt-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Content</h2>
          <p className="mt-2 whitespace-pre-wrap rounded-md bg-white/70 p-4 text-sm text-slate-700 shadow-inner">
            {content.text}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-700">Reports</h2>
          {reports.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No DR/NDR reports yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {reports.map((report) => (
                <li key={report.id} className="rounded-md bg-white p-3 text-xs shadow">
                  <span className="font-semibold">{report.type}</span> —{' '}
                  {new Date(report.timestamp).toLocaleString()} ({report.diagnosticCode ?? 'OK'})
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </article>
  );
};
