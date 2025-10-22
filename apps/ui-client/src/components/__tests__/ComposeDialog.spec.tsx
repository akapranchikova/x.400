import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComposeDialog } from '../ComposeDialog';

describe('ComposeDialog', () => {
  it('does not render when closed', () => {
    render(<ComposeDialog open={false} onClose={() => {}} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('submits the form with normalized recipients', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<ComposeDialog open onClose={onClose} onSubmit={onSubmit} />);

    await user.clear(screen.getByLabelText(/subject/i));
    await user.type(screen.getByLabelText(/subject/i), 'Integration ready');
    await user.type(screen.getByLabelText(/recipients/i), ',Alpha;Beta');
    await user.type(screen.getByLabelText(/body/i), 'Payload');

    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const args = onSubmit.mock.calls[0];
    expect(args[0]).toBe('Integration ready');
    expect(args[3]).toEqual(['Operations Desk', 'Alpha', 'Beta']);
    expect(onClose).toHaveBeenCalled();
  });
});
