import { sendAnthropic } from './anthropic.js';
import { sendOllama } from './ollama.js';
import { sendDemo } from './demo.js';
import { sendGemini } from './gemini.js';

// model: the Ollama or Gemini model name (ignored by Claude and Demo).
// options.effort: how long Claude thinks ('low' | 'medium' | 'high'); Claude only.
export function sendMessage(provider, model, ollamaUrl, messages, systemPrompt, callbacks, options = {}) {
  if (provider === 'demo') {
    return sendDemo(messages, systemPrompt, callbacks);
  }
  if (provider === 'gemini') {
    return sendGemini(messages, systemPrompt, model, callbacks);
  }
  if (provider === 'ollama') {
    return sendOllama(messages, systemPrompt, model, ollamaUrl, callbacks);
  }
  return sendAnthropic(messages, systemPrompt, callbacks, options);
}
