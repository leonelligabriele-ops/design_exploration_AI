import { useState } from 'react';
import { useTreeStore } from '../store/tree.js';

export function ModelToggle() {
  const provider = useTreeStore(s => s.provider);
  const ollamaModel = useTreeStore(s => s.ollamaModel);
  const ollamaUrl = useTreeStore(s => s.ollamaUrl);
  const setProvider = useTreeStore(s => s.setProvider);
  const setOllamaModel = useTreeStore(s => s.setOllamaModel);
  const setOllamaUrl = useTreeStore(s => s.setOllamaUrl);
  const geminiModel = useTreeStore(s => s.geminiModel);
  const setGeminiModel = useTreeStore(s => s.setGeminiModel);
  const [editingGemini, setEditingGemini] = useState(false);
  const [geminiInput, setGeminiInput] = useState(geminiModel);

  const [editingModel, setEditingModel] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [modelInput, setModelInput] = useState(ollamaModel);
  const [urlInput, setUrlInput] = useState(ollamaUrl);


  const submitModel = () => {
    setOllamaModel(modelInput.trim() || 'qwen3-coder:latest');
    setEditingModel(false);
  };

  const submitUrl = () => {
    setOllamaUrl(urlInput.trim() || '/ollama-api');
    setEditingUrl(false);
  };

  // Show short version of URL for display
  const shortUrl = ollamaUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  return (
    <div className="model-toggle">
      <div className="toggle-track">
        <span className={provider === 'anthropic' ? 'active' : ''} onClick={() => setProvider('anthropic')}>Claude</span>
        {import.meta.env.DEV && (
          <span
            className={provider === 'gemini' ? 'active' : ''}
            onClick={() => setProvider('gemini')}
            title="Google Gemini — for local experiments (needs GEMINI_KEY in .env.local)"
          >
            Gemini
          </span>
        )}
        <span className={provider === 'ollama' ? 'active' : ''} onClick={() => setProvider('ollama')}>Ollama</span>
        <span
          className={provider === 'demo' ? 'active' : ''}
          onClick={() => setProvider('demo')}
          title="Test mode: instant placeholder output, no AI and no API key needed"
        >
          Demo
        </span>
      </div>
      {provider === 'gemini' && (
        editingGemini ? (
          <input
            className="model-input"
            value={geminiInput}
            onChange={e => setGeminiInput(e.target.value)}
            onBlur={() => { setGeminiModel(geminiInput.trim() || 'gemini-flash-latest'); setEditingGemini(false); }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            autoFocus
            placeholder="model name"
          />
        ) : (
          <span
            className="model-active-badge clickable"
            onClick={() => { setGeminiInput(geminiModel); setEditingGemini(true); }}
            title="Click to change the Gemini model"
          >
            {geminiModel}
          </span>
        )
      )}
      {provider === 'demo' && (
        <span className="model-active-badge demo-badge" title="Outputs are placeholders built from your request, not made by AI">
          test mode · no AI
        </span>
      )}
      {provider === 'anthropic' && (
        <span className="model-active-badge">claude-sonnet</span>
      )}
      {provider === 'ollama' && (
        <div className="ollama-config">
          <span className="ollama-config-label">model:</span>
          {editingModel ? (
            <input
              className="model-input"
              value={modelInput}
              onChange={e => setModelInput(e.target.value)}
              onBlur={submitModel}
              onKeyDown={e => e.key === 'Enter' && submitModel()}
              autoFocus
              placeholder="model name"
            />
          ) : (
            <span className="model-active-badge clickable" onClick={() => { setModelInput(ollamaModel); setEditingModel(true); }}>
              {ollamaModel}
            </span>
          )}
          <span className="ollama-config-label">@</span>
          {editingUrl ? (
            <input
              className="model-input url-input"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onBlur={submitUrl}
              onKeyDown={e => e.key === 'Enter' && submitUrl()}
              autoFocus
              placeholder="server url"
            />
          ) : (
            <span className="ollama-url-badge clickable" onClick={() => { setUrlInput(ollamaUrl); setEditingUrl(true); }} title={ollamaUrl}>
              {shortUrl}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
