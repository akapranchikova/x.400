import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeThread } from '@x400/shared/testing';

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

    expect(screen.getByRole('button', { name: thread[0].subject })).toHaveClass('bg-blue-100');
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

    await user.click(screen.getByRole('button', { name: thread[1].subject }));
    expect(handleSelect).toHaveBeenCalledWith(thread[1].id);
  });
});
