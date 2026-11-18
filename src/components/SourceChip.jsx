// Shows that a card uses the uploaded CSV, and whether it replays it as live.
export function SourceChip({ source, shape, compact }) {
  if (source !== 'csv') return null;
  const live = shape === 'timeseries';
  return (
    <span
      className={`source-chip${compact ? ' source-chip-compact' : ''}`}
      title={live ? 'Uses your CSV, replayed row by row as if live' : 'Uses your whole CSV dataset'}
    >
      📊 CSV{live ? ' · Live replay' : ''}
    </span>
  );
}
