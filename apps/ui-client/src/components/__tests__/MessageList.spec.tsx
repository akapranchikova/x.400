import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';

const buildThread = (count: number) =>
  Array.from({ length: count }, (_, index) => {
    const timestamp = new Date(Date.now() - index * 1_000).toISOString();
    return {
      id: `message-${index}`,
      subject: `Subject ${index}`,
      folder: 'inbox',
      status: 'read',
      createdAt: timestamp,
      updatedAt: timestamp,
      sender: {
        orName: {
          o: 'Modernization',
          s: `Tester ${index}`,
        },
        address: `C=DE;O=Modernization;S=Tester${index}`,
      },
      to: [],
    };
  });

import { MessageList } from '../MessageList';

describe('MessageList', () => {
  it('shows empty state when there are no messages', () => {
    render(<MessageList messages={[]} selectedId={null} onSelect={() => {}} loading={false} />);
    expect(screen.getByText(/no messages/i)).toBeInTheDocument();
  });

  it('renders envelopes and highlights the selected item', () => {
    const thread = buildThread(2);

    render(
      <MessageList
        messages={thread}
        selectedId={thread[0].id}
        onSelect={() => {}}
        loading={false}
      />,
    );

    const btn = screen.getByRole('button', {
      name: (name) => name.startsWith(thread[0].subject),
    });

    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('bg-blue-100'); // selected item is highlighted
  });

  it('calls onSelect when clicking a message', async () => {
    const thread = buildThread(2);
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(
      <MessageList messages={thread} selectedId={null} onSelect={handleSelect} loading={false} />,
    );

    const btn = screen.getByRole('button', {
      name: (name) => name.startsWith(thread[1].subject),
    });

    await user.click(btn);
    expect(handleSelect).toHaveBeenCalledWith(thread[1].id);
  });
});
