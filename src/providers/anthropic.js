export const ANTHROPIC_MODEL = 'claude-sonnet-5-5';
// If a safety filter declines a request, the API re-runs it on a fallback model.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export async function sendAnthropic(messages, systemPrompt, callbacks, options = {}) {
  const userAssistantMsgs = messages.filter(m => m.role !== 'system');

  const headers = { 'Content-Type': 'application/json', 'anthropic-beta': FALLBACK_BETA };
  // If a workshop code is baked into the build, send it so the proxy accepts us.
  const workshopCode = import.meta.env.VITE_WORKSHOP_CODE;
  if (workshopCode) headers['X-Workshop-Code'] = workshopCode;

  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        // Thinking counts toward this limit, so leave room for long prototypes.
        max_tokens: 32000,
        fallbacks: 'default',
        // Less effort means less silent thinking before the code starts.
        ...(options.effort && { output_config: { effort: options.effort } }),
        stream: true,
        system: systemPrompt,
        messages: userAssistantMsgs,
      }),
    });

    if (!res.ok) {
      callbacks.onError(`Claude proxy error ${res.status}: ${await res.text()}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let failed = null;   // an error or refusal reported inside the stream

    function processLines(text) {
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const d = trimmed.slice(6);
        if (d === '[DONE]') continue;
        try {
          const p = JSON.parse(d);
          // Only text is shown; thinking blocks are skipped.
          if (p.type === 'content_block_delta' && p.delta?.text) {
            callbacks.onToken(p.delta.text);
          } else if (p.type === 'error') {
            failed = `Claude error: ${p.error?.message || 'unknown error'}`;
          } else if (p.type === 'message_delta' && p.delta?.stop_reason === 'refusal') {
            failed = 'Claude declined this request.';
          }
        } catch { /* skip malformed JSON */ }
      }
    }

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

    if (failed) callbacks.onError(failed);
    else callbacks.onDone();
  } catch (e) {
    callbacks.onError(`Network error: ${e.message}`);
  }
}
