import clsx from 'clsx';

import type { MessageEnvelope } from '@x400/shared';

interface MessageListProps {
  messages: MessageEnvelope[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}

const statusColors: Record<string, string> = {
  sent: 'bg-emerald-500',
  delivered: 'bg-blue-500',
  read: 'bg-purple-500',
  failed: 'bg-rose-500',
  queued: 'bg-amber-500',
};

export const MessageList = ({ messages, selectedId, onSelect, loading }: MessageListProps) => {
  if (loading) {
    return <div className="p-4 text-sm text-slate-500">Loading messages…</div>;
  }

  if (messages.length === 0) {
    return <div className="p-4 text-sm text-slate-500">No messages in this folder yet.</div>;
  }

  return (
    <ul className="flex flex-col divide-y divide-slate-200 overflow-auto" aria-label="Messages">
      {messages.map((message) => (
        <li key={message.id}>
          <button
            type="button"
            className={clsx(
              'w-full text-left px-4 py-3 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500',
              selectedId === message.id ? 'bg-blue-100' : 'bg-white hover:bg-blue-50',
            )}
            onClick={() => onSelect(message.id)}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">{message.subject}</h3>
              <span
                className={clsx(
                  'inline-flex h-2 w-2 rounded-full',
                  statusColors[message.status] ?? 'bg-slate-400',
                )}
                aria-hidden
              />
            </div>
            <p className="mt-1 text-xs text-slate-700">
              {message.sender.orName.o ?? 'Unknown organization'} •{' '}
              {new Date(message.createdAt).toLocaleString()}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
};
