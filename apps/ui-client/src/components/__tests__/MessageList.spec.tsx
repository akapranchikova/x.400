import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeThread } from '@x400/shared/testing';
import { vi, describe, it, expect } from 'vitest';

import { MessageList } from '../MessageList';

describe('MessageList', () => {
  it('shows empty state when there are no messages', () => {
    render(<MessageList messages={[]} selectedId={null} onSelect={() => {}} loading={false} />);
    expect(screen.getByText(/no messages/i)).toBeInTheDocument();
  });

  it('renders envelopes and highlights the selected item', () => {
    const thread = makeThread(2).map((message) => ({
      ...message.envelope,
      createdAt: message.envelope.createdAt,
      updatedAt: message.envelope.updatedAt,
    }));

    render(
      <MessageList
        messages={thread}
        selectedId={thread[0].id}
        onSelect={() => {}}
        loading={false}
      />,
    );

    // Find the heading with exact subject, then climb to the wrapping button.
    const btn = screen
      .getByRole('heading', { name: thread[0].subject })
      .closest('button') as HTMLButtonElement;

    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('bg-blue-100'); // selected item is highlighted
  });

  it('calls onSelect when clicking a message', async () => {
    const thread = makeThread(2).map((message) => ({
      ...message.envelope,
      createdAt: message.envelope.createdAt,
      updatedAt: message.envelope.updatedAt,
    }));
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(
      <MessageList messages={thread} selectedId={null} onSelect={handleSelect} loading={false} />,
    );

    const btn = screen
      .getByRole('heading', { name: thread[1].subject })
      .closest('button') as HTMLButtonElement;

    await user.click(btn);
    expect(handleSelect).toHaveBeenCalledWith(thread[1].id);
  });
});
