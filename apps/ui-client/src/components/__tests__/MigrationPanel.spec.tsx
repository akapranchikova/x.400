import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MigrationPanel } from '../MigrationPanel';

const transportMock = {
  migration: {
    import: vi.fn().mockResolvedValue({ jobId: 'job-1' }),
    progress: vi.fn().mockResolvedValue({
      jobId: 'job-1',
      status: 'completed',
      total: 1,
      processed: 1,
      imported: 1,
      failed: 0,
      duplicates: 0,
      dryRun: true,
      checksumOk: true,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      currentPath: '/legacy/message.fwm',
      notes: [],
    }),
    report: vi.fn().mockResolvedValue({
      jobId: 'job-1',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      total: 1,
      imported: 1,
      failed: 0,
      duplicates: 0,
      dryRun: true,
      checksumOk: true,
      notes: ['dry-run'],
      errors: [],
    }),
  },
};

vi.mock('../../lib/transport', () => ({
  getTransport: () => transportMock,
}));

describe('MigrationPanel', () => {
  beforeEach(() => {
    transportMock.migration.import.mockClear();
    transportMock.migration.progress.mockClear();
    transportMock.migration.report.mockClear();
  });

  it('submits migration request and renders report summary', async () => {
    const user = userEvent.setup();
    render(<MigrationPanel open onClose={() => {}} />);

    await user.type(screen.getByLabelText(/source path/i), '/legacy');
    await user.selectOptions(screen.getByLabelText(/mode/i), 'fwz');

    await user.click(screen.getByRole('button', { name: /start migration/i }));

    await waitFor(() => expect(transportMock.migration.import).toHaveBeenCalled());
    expect(transportMock.migration.import).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/legacy', mode: 'fwz' }),
    );

    expect(await screen.findByText(/Imported 1 of 1 items/)).toBeInTheDocument();
  });
});
