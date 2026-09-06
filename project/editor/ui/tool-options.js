/**
 * The tool options bar (docs/VECTOR_EDITING.md).
 *
 * What a tool needs to know before it draws — the fill and stroke a new shape
 * gets, how many sides a polygon has, whether the grid snaps — used to be
 * nowhere: every shape arrived blue, every rectangle with rounded corners, and
 * the first thing after each one was a trip to the Inspector. The bar sits
 * under the vector toolbar and shows the options of the tool in hand; for the
 * Node tool it holds the point operations (curve, straight, smooth, corner,
 * delete) that have no gesture of their own.
 *
 * The options are UI preferences, not project data: they are remembered in
 * the browser and never enter the document.
 */
export const DRAW_OPTIONS_KEY = 'boop.drawOptions.v1';

export const DEFAULT_DRAW_OPTIONS = Object.freeze({
  fill: '#60a5fa', stroke: '#1f2937', strokeWidth: 2, cornerRadius: 0,
  sides: 5, star: false, inner: 0.5, fontSize: 24, text: 'Text',
  grid: false, gridSize: 10, snap: false
});

const HEX = /^#[0-9a-f]{6}$/i;
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function normalizeDrawOptions(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const paint = (value, fallback) => (value === 'none' || HEX.test(String(value || '')) ? String(value).toLowerCase() : fallback);
  const number = (value, fallback, min, max) => { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };
  return {
    fill: paint(source.fill, DEFAULT_DRAW_OPTIONS.fill),
    stroke: paint(source.stroke, DEFAULT_DRAW_OPTIONS.stroke),
    strokeWidth: number(source.strokeWidth, DEFAULT_DRAW_OPTIONS.strokeWidth, 0, 200),
    cornerRadius: number(source.cornerRadius, DEFAULT_DRAW_OPTIONS.cornerRadius, 0, 500),
    sides: Math.round(number(source.sides, DEFAULT_DRAW_OPTIONS.sides, 3, 24)),
    star: Boolean(source.star),
    inner: number(source.inner, DEFAULT_DRAW_OPTIONS.inner, 0.1, 0.9),
    fontSize: number(source.fontSize, DEFAULT_DRAW_OPTIONS.fontSize, 1, 500),
    text: typeof source.text === 'string' && source.text.trim() ? source.text.slice(0, 200) : DEFAULT_DRAW_OPTIONS.text,
    grid: Boolean(source.grid),
    gridSize: number(source.gridSize, DEFAULT_DRAW_OPTIONS.gridSize, 1, 200),
    snap: Boolean(source.snap)
  };
}

export function readDrawOptions(storage = globalThis.localStorage) {
  try { return normalizeDrawOptions(JSON.parse(storage?.getItem(DRAW_OPTIONS_KEY) || '{}')); } catch { return normalizeDrawOptions(); }
}

export function writeDrawOptions(options, storage = globalThis.localStorage) {
  try { storage?.setItem(DRAW_OPTIONS_KEY, JSON.stringify(normalizeDrawOptions(options))); } catch { /* storage may be unavailable */ }
}

const TOOL_HINTS = {
  pen: 'Click for a corner, drag for a curve. Click the first point to close, Enter or double-click to finish, Backspace removes the last point.',
  line: 'Drag to draw. Shift keeps it to 45°.',
  rect: 'Drag to draw. Shift makes a square, Alt draws from the centre.',
  ellipse: 'Drag to draw. Shift makes a circle, Alt draws from the centre.',
  polygon: 'Drag from the centre outwards. Shift locks the rotation to 15°.',
  text: 'Click where the text goes, then type it in the Inspector.',
  node: 'Drag a point or a handle. Double-click the outline to add a point, Alt breaks a pair of handles.',
  select: 'Click a piece; Shift+click adds another; drag on empty canvas to select what it surrounds.',
  hand: 'Drag to move the view. The wheel pans, Ctrl/Cmd + wheel zooms.'
};

/** Which tools get the paint fields. */
const PAINTED = new Set(['pen', 'line', 'rect', 'ellipse', 'polygon', 'text']);

/**
 * @param {HTMLElement} host
 * @param {object} deps
 * @param {() => string} deps.getTool
 * @param {() => object} deps.getOptions
 * @param {(patch: object) => void} deps.setOptions
 * @param {{ focused: () => object|null, convert: (kind: string) => void, remove: () => void }} [deps.node]
 * @param {{ ids: () => string[], align: (kind: string) => void, distribute: (axis: string) => void, group: () => void }} [deps.selection]
 */
export function createToolOptions(host, { getTool, getOptions, setOptions, node = null, selection = null }) {
  host.addEventListener('change', (event) => {
    const target = event.target;
    const key = target.dataset.drawOption;
    if (!key) return;
    if (target.dataset.drawNone !== undefined) { setOptions({ [key]: target.checked ? 'none' : (host.querySelector(`input[type=color][data-draw-option="${key}"]`)?.value || DEFAULT_DRAW_OPTIONS[key]) }); render(); return; }
    setOptions({ [key]: target.type === 'checkbox' ? target.checked : target.type === 'number' || target.type === 'range' ? Number(target.value) : target.value });
    if (key === 'fill' || key === 'stroke' || key === 'star' || key === 'grid') render();
  });
  host.addEventListener('input', (event) => {
    const target = event.target;
    if (target.type === 'range' && target.dataset.drawOption) setOptions({ [target.dataset.drawOption]: Number(target.value) });
  });
  host.addEventListener('click', (event) => {
    const arrange = event.target.closest('button[data-arrange]');
    if (arrange && selection) {
      const [verb, what] = arrange.dataset.arrange.split(':');
      if (verb === 'align') selection.align(what);
      else if (verb === 'distribute') selection.distribute(what);
      else if (verb === 'group') selection.group();
      return;
    }
    const button = event.target.closest('button[data-node-action]');
    if (!button || !node) return;
    const action = button.dataset.nodeAction;
    if (action === 'delete') node.remove();
    else node.convert(action);
    render();
  });

  const paintField = (key, label, options) => {
    const value = options[key];
    const none = value === 'none';
    return `<span class="tool-field tool-paint"><span>${label}</span><input type="color" data-draw-option="${key}" aria-label="${label} colour for new shapes" value="${none ? '#888888' : esc(value)}"${none ? ' disabled' : ''}><label class="check"><input type="checkbox" data-draw-option="${key}" data-draw-none aria-label="No ${label.toLowerCase()} on new shapes"${none ? ' checked' : ''}>None</label></span>`;
  };
  const numberField = (key, label, options, attrs = '') => `<label class="tool-field"><span>${label}</span><input type="number" data-draw-option="${key}" aria-label="${label}" value="${esc(options[key])}" ${attrs}></label>`;

  function render() {
    const tool = getTool();
    const options = normalizeDrawOptions(getOptions());
    host.dataset.tool = tool;
    const parts = [];
    if (PAINTED.has(tool)) {
      if (tool !== 'line' && tool !== 'text') parts.push(paintField('fill', 'Fill', options));
      if (tool === 'text') parts.push(paintField('fill', 'Colour', options));
      if (tool !== 'text') parts.push(paintField('stroke', 'Stroke', options), numberField('strokeWidth', 'Width', options, 'min="0" step="0.5"'));
    }
    if (tool === 'rect') parts.push(numberField('cornerRadius', 'Corner', options, 'min="0" step="1"'));
    if (tool === 'polygon') parts.push(numberField('sides', 'Sides', options, 'min="3" max="24" step="1"'), `<label class="check tool-field"><input type="checkbox" data-draw-option="star"${options.star ? ' checked' : ''}>Star</label>`, options.star ? `<label class="tool-field"><span>Inner</span><input type="range" data-draw-option="inner" aria-label="Star inner radius" min="0.1" max="0.9" step="0.05" value="${options.inner}"></label>` : '');
    if (tool === 'text') parts.push(numberField('fontSize', 'Size', options, 'min="1" step="1"'), `<label class="tool-field"><span>Text</span><input type="text" data-draw-option="text" aria-label="Text to place" value="${esc(options.text)}"></label>`);
    if (tool === 'select' && selection) {
      // Several pieces at once: line them up, spread them out, or make them one
      // group. One piece lines up on the working area instead.
      const ids = selection.ids();
      if (ids.length) {
        const many = ids.length > 1;
        const item = (verb, what, label, title, enabled = true) => `<button type="button" class="secondary" data-arrange="${verb}:${what}" title="${title}"${enabled ? '' : ' disabled'}>${label}</button>`;
        parts.push(`<span class="tool-field tool-arrange" role="group" aria-label="Arrange"><b>${ids.length} selected</b><span>Align</span>${[
          ['left', 'Left', many ? 'Line up the left edges' : 'Put it on the left edge of the working area'], ['center', 'Centre', many ? 'Line up the centres' : 'Centre it in the working area'], ['right', 'Right', many ? 'Line up the right edges' : 'Put it on the right edge of the working area'],
          ['top', 'Top', many ? 'Line up the top edges' : 'Put it at the top of the working area'], ['middle', 'Middle', many ? 'Line up the middles' : 'Centre it vertically in the working area'], ['bottom', 'Bottom', many ? 'Line up the bottom edges' : 'Put it at the bottom of the working area']
        ].map(([what, label, title]) => item('align', what, label, title)).join('')}<span>Spread</span>${item('distribute', 'horizontal', '↔', 'Equal gaps left to right (three or more pieces)', ids.length > 2)}${item('distribute', 'vertical', '↕', 'Equal gaps top to bottom (three or more pieces)', ids.length > 2)}${item('group', 'selection', 'Group', 'Make the selected pieces one group (Ctrl/Cmd+G)', many)}</span>`);
      }
    }
    if (tool === 'node' && node) {
      const focused = node.focused();
      const has = Boolean(focused);
      const pressed = (kind) => (focused && ((kind === 'smooth' && focused.smooth) || (kind === 'corner' && focused.handles && !focused.smooth)) ? 'true' : 'false');
      parts.push(`<span class="tool-field tool-node-actions" role="group" aria-label="Point">${[
        ['curve', 'Curve', 'Turn the segments at this point into curves'], ['straight', 'Straight', 'Turn them into straight lines'],
        ['smooth', 'Smooth', 'Line the two handles up'], ['corner', 'Corner', 'Let the handles move on their own']
      ].map(([kind, label, title]) => `<button type="button" class="secondary" data-node-action="${kind}" aria-pressed="${pressed(kind)}" title="${title}"${has ? '' : ' disabled'}>${label}</button>`).join('')}<button type="button" class="secondary danger" data-node-action="delete" title="Remove this point (Delete)"${has ? '' : ' disabled'}>Delete point</button></span>`);
    }
    // The hint rides in the same line as the options, between the tool's own
    // fields and the grid: the bar is docked above the working area now, so
    // every line it takes is a line the artwork does not get.
    const hint = TOOL_HINTS[tool] || '';
    if (hint) parts.push(`<p class="tool-hint">${esc(hint)}</p>`);
    parts.push(`<span class="tool-field tool-grid" role="group" aria-label="Grid"><label class="check"><input type="checkbox" data-draw-option="grid"${options.grid ? ' checked' : ''}>Grid</label><label class="check"><input type="checkbox" data-draw-option="snap"${options.snap ? ' checked' : ''}>Snap</label>${options.grid || options.snap ? `<input type="number" data-draw-option="gridSize" aria-label="Grid size" min="1" step="1" value="${options.gridSize}">` : ''}</span>`);
    host.innerHTML = `<div class="tool-options-row">${parts.join('')}</div>`;
    host.hidden = false;
  }

  return { render };
}
