import { useRef } from 'react';
import { useTreeStore } from '../store/tree.js';
import { SettingsMenu } from './SettingsMenu.jsx';
import { buildExportFile, readSessionFromFile } from '../export/exportFile.js';

export function Toolbar() {
  const nodes = useTreeStore(s => s.nodes);
  const addRoot = useTreeStore(s => s.addRoot);
  const saveToJSON = useTreeStore(s => s.saveToJSON);
  const loadFromJSON = useTreeStore(s => s.loadFromJSON);
  const restartTour = useTreeStore(s => s.restartTour);
  const fileRef = useRef(null);

  // Save: one file that is both a readable report (open it in a browser) and
  // the saved session (open it here with Open to keep working).
  const handleSave = () => {
    const { blob, name } = buildExportFile(nodes, saveToJSON());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  };

  const handleLoad = () => fileRef.current?.click();

  // Opens a file saved by Save (.html), or an older .json save.
  const handleFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (nodes.length && !window.confirm('Open this file? The ideas on your canvas now will be replaced. Save them first if you want to keep them.')) return;
    const r = new FileReader();
    r.onload = () => {
      const text = String(r.result);
      const json = f.name.toLowerCase().endsWith('.json') ? text : readSessionFromFile(text);
      if (!json || !loadFromJSON(json)) {
        window.alert('This file can’t be opened in Biosketch. Choose a file you saved with the Save button.');
      }
    };
    r.readAsText(f);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left" data-tour="file">
        <button onClick={addRoot} data-tour="new-idea">+ New idea</button>
        <button
          onClick={handleSave}
          disabled={!nodes.length}
          title="Save your work as one file. Open it in a browser to read it and try the prototypes, or open it here with Open to keep working."
        >
          Save
        </button>
        <button onClick={handleLoad} title="Open a file you saved, to keep working on it">Open</button>
        <button onClick={restartTour} title="Show the guided tour again">Tutorial</button>
        <input ref={fileRef} type="file" accept=".html,.json" onChange={handleFile} hidden />
        <span className="toolbar-hint">Drag the background to move · Scroll to zoom</span>
      </div>
      <SettingsMenu />
    </div>
  );
}
