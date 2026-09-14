// Displays the data source a node was generated against.
// For CSV sources, optionally includes an inline Timeseries/Dataset toggle
// (when onShapeChange is provided). For other sources it is read-only.
export function SourceChip({ source, shape, sensorName, onShapeChange, compact }) {
  if (!source || source === 'none') return null;

  const cls = `source-chip${compact ? ' source-chip-compact' : ''}`;

  if (source === 'mediapipe') {
    return <span className={cls} title="Sketch generated for live webcam / MediaPipe skeleton data">📷 Webcam</span>;
  }
  if (source === 'bluetooth') {
    return <span className={cls} title="Sketch generated for Bluetooth sensor data">📡 {sensorName || 'Sensor'}</span>;
  }
  if (source === 'csv') {
    const effShape = shape || 'timeseries';
    if (onShapeChange && !compact) {
      return (
        <div
          className={`${cls} source-chip-csv`}
          title="CSV data. Toggle how the next generation from this node should treat it: row-by-row stream (Timeseries) or full dataset upfront (Dataset)."
        >
          <span className="source-chip-label">📊 CSV</span>
          <span
            className={`source-chip-shape${effShape === 'timeseries' ? ' active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onShapeChange('timeseries'); }}
          >
            Timeseries
          </span>
          <span
            className={`source-chip-shape${effShape === 'dataset' ? ' active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onShapeChange('dataset'); }}
          >
            Dataset
          </span>
        </div>
      );
    }
    const label = effShape === 'dataset' ? 'Dataset' : 'Timeseries';
    return <span className={cls} title={`Sketch generated for CSV data, ${label.toLowerCase()} mode`}>📊 CSV · {label}</span>;
  }
  return null;
}
