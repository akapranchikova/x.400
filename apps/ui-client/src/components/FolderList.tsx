import clsx from 'clsx';

import type { Folder } from '@x400/shared';

interface FolderListProps {
  folders: Folder[];
  activeFolder: string;
  onSelect: (folder: string) => void;
  disabled?: boolean;
}

const folderNames: Record<string, string> = {
  inbox: 'Inbox',
  outbox: 'Outbox',
  failed: 'Failed',
  archive: 'Archive',
  followUp: 'Follow-up',
};

export const FolderList = ({
  folders,
  activeFolder,
  onSelect,
  disabled = false,
}: FolderListProps) => {
  return (
    <nav
      aria-label="Folders"
      className="flex flex-col gap-2 p-4 bg-white/70 backdrop-blur rounded-lg shadow-sm"
    >
      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          className={clsx(
            'flex items-center justify-between rounded-md px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500',
            activeFolder === folder.id
              ? 'bg-blue-600 text-white shadow'
              : 'bg-white text-slate-700 hover:bg-blue-50',
            disabled && 'cursor-not-allowed opacity-60 hover:bg-white',
          )}
          onClick={() => {
            if (disabled) {
              return;
            }
            onSelect(folder.id);
          }}
          disabled={disabled}
          aria-disabled={disabled}
        >
          <span className="font-medium">{folderNames[folder.id] ?? folder.name}</span>
          <span className="text-xs rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">
            {folder.unreadCount}
          </span>
        </button>
      ))}
    </nav>
  );
};
