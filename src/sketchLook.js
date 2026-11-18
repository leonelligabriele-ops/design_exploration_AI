// The unfinished, hand-drawn look of Sketch-stage prototypes. A rough sketch
// invites critique where a neat one reads as an answer (Buxton), so every line
// of a sketch is made to wobble like pencil, whatever the AI drew. Applied by
// the tool rather than asked of the AI, so the look is the same every time.

const STYLE = `<style>body{filter:url(#bs-pencil)}</style>`;
const FILTER = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="bs-pencil" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`;

export function withSketchLook(html) {
  let out = html.includes('</head>') ? html.replace('</head>', STYLE + '</head>') : STYLE + html;
  const i = out.lastIndexOf('</body>');
  out = i === -1 ? out + FILTER : out.slice(0, i) + FILTER + out.slice(i);
  return out;
}
