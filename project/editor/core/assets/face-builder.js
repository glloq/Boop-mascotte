export function buildFaceSvg(options = {}) {
  const head = options.head || 'circle';
  const eyes = options.eyes || 'oval';
  const mouth = options.mouth || 'smile';

  const headShape = head === 'square'
    ? '<rect id="head" x="25" y="25" width="190" height="190" rx="40" fill="#fde68a" />'
    : '<circle id="head" cx="120" cy="120" r="100" fill="#fde68a" />';

  const eyeShape = eyes === 'dot'
    ? '<circle id="eyeLeft" cx="85" cy="100" r="8" fill="#111827" /><circle id="eyeRight" cx="155" cy="100" r="8" fill="#111827" />'
    : '<ellipse id="eyeLeft" cx="85" cy="100" rx="12" ry="16" fill="#111827" /><ellipse id="eyeRight" cx="155" cy="100" rx="12" ry="16" fill="#111827" />';

  const mouthPath = mouth === 'flat'
    ? 'M 85 160 L 155 160'
    : mouth === 'sad'
      ? 'M 80 170 Q 120 140 160 170'
      : 'M 80 155 Q 120 185 160 155';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">${headShape}${eyeShape}<path id="mouth" d="${mouthPath}" stroke="#111827" stroke-width="8" fill="none" stroke-linecap="round" /></svg>`;
}

/** A generated face deliberately exposes only roles present in buildFaceSvg(). */
export function buildFaceProjectTemplate(options = {}) {
  return { id: 'built-face', name: 'Built Face', kind: 'builder', svg: buildFaceSvg(options) };
}
