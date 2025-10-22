import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FolderList } from '../FolderList';

const folders = [
  { id: 'inbox', name: 'Inbox', unreadCount: 2 },
  { id: 'outbox', name: 'Outbox', unreadCount: 0 },
  { id: 'archive', name: 'Archive', unreadCount: 5 },
];

describe('FolderList', () => {
  it('renders provided folders with counts', () => {
    render(<FolderList folders={folders} activeFolder="inbox" onSelect={() => {}} />);

    expect(screen.getByRole('button', { name: /inbox/i })).toHaveClass('bg-blue-600');
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('invokes onSelect when clicking a folder', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(<FolderList folders={folders} activeFolder="outbox" onSelect={handleSelect} />);

    await user.click(screen.getByRole('button', { name: /archive/i }));

    expect(handleSelect).toHaveBeenCalledWith('archive');
  });
});
