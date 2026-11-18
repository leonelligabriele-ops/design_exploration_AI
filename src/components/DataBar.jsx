import { useRef, useCallback } from 'react';
import { useTreeStore } from '../store/tree.js';
import { loadDataset, clearDataset } from '../datalayer/playback.js';

export function DataBar() {
  const dataFlowing = useTreeStore(s => s.dataFlowing);
  const csvColumns = useTreeStore(s => s.csvColumns);
  const csvRowCount = useTreeStore(s => s.csvRowCount);
  const csvFileName = useTreeStore(s => s.csvFileName);
  const setDataSource = useTreeStore(s => s.setDataSource);
  const setDataFlowing = useTreeStore(s => s.setDataFlowing);
  const setCsvColumns = useTreeStore(s => s.setCsvColumns);
  const setCsvRowCount = useTreeStore(s => s.setCsvRowCount);
  const setCsvFileName = useTreeStore(s => s.setCsvFileName);

  const fileRef = useRef(null);

  const stopAll = useCallback(() => {
    clearDataset();
    setDataFlowing(false);
  }, [setDataFlowing]);

  const handleRemove = useCallback(() => {
    stopAll();
    setDataSource('none');
  }, [stopAll, setDataSource]);

  const handleCSVFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // PapaParse loaded from CDN
    window.Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const columns = results.meta.fields || [];
        stopAll();
        setDataSource('csv');
        setCsvFileName(file.name);
        setCsvColumns(columns);
        setCsvRowCount(results.data.length);
        loadDataset(results.data, columns);
        setDataFlowing(true);
      },
      error: (err) => console.error('CSV parse error:', err),
    });
  }, [stopAll, setDataSource, setCsvFileName, setCsvColumns, setCsvRowCount, setDataFlowing]);

  const loaded = csvColumns.length > 0;

  return (
    <div className="data-bar">
      <div className="data-bar-left" data-tour="data">
        <span className="data-bar-title">Your data</span>
        {loaded ? (
          <>
            <span className="csv-file" title={csvColumns.join(', ')}>
              {dataFlowing && <span className="pulse" />}
              <span className="csv-file-name">{csvFileName}</span>
              <span className="csv-file-meta">
                {csvRowCount} rows · {csvColumns.length} columns
              </span>
            </span>
            <button onClick={() => fileRef.current?.click()}>Replace</button>
            <button className="stop-btn" onClick={handleRemove}>Remove</button>
          </>
        ) : (
          <>
            <button className="active" onClick={() => fileRef.current?.click()}>Upload CSV</button>
            <span className="data-bar-hint">Upload your biodata as a CSV file to use it in your prototypes</span>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVFile} hidden />
    </div>
  );
}
