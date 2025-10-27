interface SavedFiltersBarProps {
  filters: { id: string; label: string; query: string }[];
  onSelect: (filter: { id: string; label: string; query: string }) => void;
  onSave: () => void;
}

export const SavedFiltersBar = ({ filters, onSelect, onSave }: SavedFiltersBarProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white/80 p-2 text-xs text-slate-600">
      <span className="font-medium">Saved filters:</span>
      {filters.length === 0 ? (
        <span className="text-slate-400">
          None yet. Create one from the advanced search dialog.
        </span>
      ) : (
        filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 transition hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-200"
            onClick={() => onSelect(filter)}
          >
            {filter.label}
          </button>
        ))
      )}
      <button
        type="button"
        className="ml-auto rounded-md border border-slate-200 px-2 py-1 text-xs"
        onClick={onSave}
      >
        Save current filter
      </button>
    </div>
  );
};
