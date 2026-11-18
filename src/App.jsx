import { Toolbar } from './components/Toolbar.jsx';
import { DataBar } from './components/DataBar.jsx';
import { Canvas } from './components/Canvas.jsx';
import { Tour } from './components/Tour.jsx';

export default function App() {
  return (
    <div className="app-layout">
      <Toolbar />
      <DataBar />
      <Canvas />
      <Tour />
    </div>
  );
}
