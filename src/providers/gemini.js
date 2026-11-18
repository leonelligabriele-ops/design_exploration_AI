// Gemini (Google) — for local experiments. Requests go to /api/gemini, which
// the Vite dev server forwards to Google's OpenAI-compatible endpoint and signs
// with GEMINI_KEY from .env.local, so the key never reaches the browser.

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

// Anthropic-style message parts → OpenAI-style parts (text + image_url).
function toOpenAIContent(content) {
  if (!Array.isArray(content)) return content;
  return content.map(part => {
    if (part.type === 'image' && part.source?.type === 'base64') {
      return { type: 'image_url', image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` } };
    }
    return { type: 'text', text: part.text ?? '' };
  });
}

export async function sendGemini(messages, systemPrompt, model, callbacks) {
  const body = {
    model: model || DEFAULT_GEMINI_MODEL,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: toOpenAIContent(m.content) })),
    ],
  };

  try {
    const res = await fetch('/api/gemini/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      callbacks.onError(res.status === 404
        ? 'Gemini is only set up for local use (npm run dev with GEMINI_KEY in .env.local).'
        : `Gemini error ${res.status}: ${text.slice(0, 400)}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const processLines = (text) => {
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const d = trimmed.slice(6).trim();
        if (d === '[DONE]') continue;
        try {
          const tok = JSON.parse(d).choices?.[0]?.delta?.content;
          if (tok) callbacks.onToken(tok);
        } catch { /* partial or non-JSON line */ }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lastNewline = buf.lastIndexOf('\n');
      if (lastNewline !== -1) {
        processLines(buf.slice(0, lastNewline));
        buf = buf.slice(lastNewline + 1);
      }
    }
    if (buf.trim()) processLines(buf);
    callbacks.onDone();
  } catch (e) {
    callbacks.onError(`Cannot reach Gemini (${e.message}). Is the local server running?`);
  }
}
