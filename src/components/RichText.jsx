// Light formatting for AI text: **bold** and *italic*, shown without the
// asterisks. Everything else stays plain text.
export function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*\s][^*]*\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}
