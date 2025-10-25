interface GatewayPreviewProps {
  mapping: { input: string; mapped: string; warnings: string[] } | null;
  onPreview: (value: string) => void;
}

export const GatewayPreview = ({ mapping, onPreview }: GatewayPreviewProps) => {
  return (
    <section
      className="rounded-lg border border-blue-100 bg-white/90 p-4 text-sm shadow"
      aria-label="Gateway preview"
    >
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Gateway preview</h3>
        <button
          type="button"
          className="rounded-md border border-slate-200 px-3 py-1 text-xs"
          onClick={() => {
            const value = window.prompt(
              'Enter an O/R address to map to RFC822',
              mapping?.input ?? 'C=DE;O=Org;S=User',
            );
            if (value) {
              onPreview(value);
            }
          }}
        >
          Preview mapping
        </button>
      </header>
      {mapping ? (
        <dl className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">Input</dt>
            <dd className="font-mono text-xs text-slate-700">{mapping.input}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">Mapped</dt>
            <dd className="font-mono text-xs text-emerald-600">{mapping.mapped}</dd>
          </div>
          {mapping.warnings.length ? (
            <div>
              <dt className="text-slate-500">Warnings</dt>
              <dd className="text-xs text-amber-600">{mapping.warnings.join(', ')}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="text-xs text-slate-500">
          Run a preview to see how the gateway translates addresses.
        </p>
      )}
    </section>
  );
};
