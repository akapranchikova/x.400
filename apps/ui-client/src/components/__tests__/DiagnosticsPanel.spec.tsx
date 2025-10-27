import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { DiagnosticsPanel } from '../DiagnosticsPanel';

describe('DiagnosticsPanel', () => {
  it('renders system information when opened', () => {
    const handleClose = vi.fn();
    render(
      <DiagnosticsPanel
        open
        onClose={handleClose}
        status={null}
        sessionPeer="http://127.0.0.1:3333"
        onSnapshot={() => undefined}
      />,
    );

    expect(screen.getByText(/Diagnostics and Support/i)).toBeInTheDocument();
    expect(screen.getByText(/IPC endpoint/i)).toBeInTheDocument();
  });
});
