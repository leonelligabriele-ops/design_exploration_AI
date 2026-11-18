import { useEffect, useState } from 'react';
import { useTreeStore } from '../store/tree.js';
import { getPlayback, subscribe, play, pause, seek, setSpeed } from '../datalayer/playback.js';

const SPEEDS = [0.25, 0.5, 1, 2, 4];

// The "Whole dataset / Replay as live" switch is hidden for now: every new
// prototype gets the whole dataset. Cards that were already built for live
// replay keep their play / pause / timeline controls.
export function DataMode({ node }) {
  const csvLoaded = useTreeStore(s => s.csvColumns.length > 0);
  const builtLive = !!node.code && (node.builtShape || node.shape) === 'timeseries';
  if (!builtLive || !csvLoaded) return null;
  return (
    <div className="ne-datamode">
      <PlaybackBar />
    </div>
  );
}

function PlaybackBar() {
  const [pb, setPb] = useState(getPlayback());
  useEffect(() => subscribe(setPb), []);

  return (
    <div className="playback">
      <button
        className="playback-btn"
        onClick={pb.playing ? pause : play}
        aria-label={pb.playing ? 'Pause' : 'Play'}
        title={pb.playing ? 'Pause' : 'Play'}
      >
        {pb.playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14"><rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor" /><rect x="8" y="2" width="3" height="10" rx="1" fill="currentColor" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M4 2.5v9l7.5-4.5z" fill="currentColor" /></svg>
        )}
      </button>
      <input
        className="playback-range"
        type="range"
        min={0}
        max={Math.max(0, pb.rowCount - 1)}
        value={pb.index}
        onChange={e => seek(Number(e.target.value))}
        aria-label="Position in the recording"
      />
      <span className="playback-label" title={pb.timeCol ? `Timing from the "${pb.timeCol}" column` : 'No time column found: 10 rows per second'}>
        {pb.label}
      </span>
      <select
        className="playback-speed"
        value={pb.speed}
        onChange={e => setSpeed(Number(e.target.value))}
        aria-label="Playback speed"
      >
        {SPEEDS.map(s => <option key={s} value={s}>{s}×</option>)}
      </select>
    </div>
  );
}
