/**
 * The right column of the Character Builder (docs/CHARACTER_BUILDER.md).
 *
 * ```text
 * Eyes                              [Eyes]
 * [Left eye] [Right eye]            ← the piece in hand
 * Position      X [  ]  Y [  ]
 * Size and turn Scale [ ] Rotation [ ]
 * Colours       ■ ■ ■               ← one swatch per colour, whatever draws it
 * Shape         [Edit Shape]        ← the vector tools, on this piece, in Artwork
 * ▸ Advanced                        ← the rig and the artwork inspector
 * ```
 *
 * Every field writes through the builder, which writes through the existing
 * artwork commands: this panel owns no project data and reads no SVG. Like
 * the Artwork inspector it waits to redraw while a field inside it has focus,
 * because every write comes straight back as a document notification and a
 * redraw under the field being typed in throws the field away.
 */
import { createComponent } from '../component.js';
import { disclosureSection } from '../disclosure.js';
import { rememberOpen, setPanelHtml } from '../panel-render.js';
import { handPlacementMarkup } from './hand-placement-panel.js';
import { paletteRowsMarkup } from './part-browser.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = (value, digits = 2) => { const rounded = Math.round(Number(value) * 10 ** digits) / 10 ** digits; return Object.is(rounded, -0) ? '0' : String(rounded); };

/** How many swatches a piece shows before the rest fold into a count. */
export const PALETTE_LIMIT = 16;

function subject(model) {
  const name = model.category?.label || 'Artwork';
  const badge = model.piece?.partName ? `<span class="semantic-badge">${esc(model.piece.partName)}</span>` : (model.kind === 'piece' ? '<span class="small">No face part uses this piece</span>' : '');
  // The library style the part came from, when it came from one.
  const style = model.category?.styleName ? `<span class="small" data-part-style="${esc(model.category.styleId)}">Style: ${esc(model.category.styleName)}</span>` : '';
  return `<div class="part-subject" data-part-subject="${esc(model.category?.id || 'artwork')}"><strong>${esc(name)}</strong>${badge}${style}</div>`;
}

function pieceChips(model) {
  if (!model.pieces || model.pieces.length < 2) return '';
  return `<div class="part-pieces" role="group" aria-label="Pieces">${model.pieces.map((piece) => `<button type="button" class="chip${piece.id === model.piece.id ? ' chip-active' : ''}" data-part-piece="${esc(piece.id)}" aria-pressed="${piece.id === model.piece.id}">${esc(piece.label)}</button>`).join('')}</div><p class="small">All ${model.pieces.length} are selected: a drag on the canvas moves them together. The fields below edit ${esc(model.piece.label)}.</p>`;
}

/** A pair edited as one: the box that says so, and the distance between the two. */
function pairFields(piece) {
  const pair = piece.pair;
  if (!pair) return '';
  const linked = `<label class="part-linked"><input type="checkbox" data-part-linked${pair.linked ? ' checked' : ''} aria-label="${esc(pair.label)}"> ${esc(pair.label)}</label>`;
  const note = pair.linked
    ? `<p class="small" data-part-pair-note>${esc(pair.peerLabel)} mirrors every change: a move out is a move out on both sides. Untick to edit ${esc(piece.label)} alone.</p>`
    : `<p class="small" data-part-pair-note>${esc(piece.label)} alone. Tick to edit both again.</p>`;
  const spacing = pair.linked && pair.spacing !== null ? `<div class="part-fields"><label>Spacing<input type="number" step="0.5" data-part-spacing aria-label="Spacing between the two" value="${number(pair.spacing)}"></label></div>` : '';
  return `${linked}${note}${spacing}`;
}

function transformFields(piece) {
  if (piece.locked) return '<p class="small" data-part-locked>This piece is locked. Unlock it in Artwork to move it.</p>';
  const t = piece.transform;
  const instance = piece.instance ? `<p class="small" data-part-instance="${esc(piece.instance.id)}">Position, size and turn are the whole part\'s (${esc(piece.instance.label)}): a library part moves as one.</p>` : '';
  return `${instance}${pairFields(piece)}<h4>Position</h4><div class="part-fields">
      <label>X<input type="number" step="0.5" data-part-transform="x" aria-label="X position" value="${number(t.x)}"></label>
      <label>Y<input type="number" step="0.5" data-part-transform="y" aria-label="Y position" value="${number(t.y)}"></label></div>
    <h4>Size and turn</h4><div class="part-fields">
      <label>Scale<input type="number" step="0.05" min="0.05" data-part-scale aria-label="Scale" value="${number(t.scale, 3)}"></label>
      <label>Rotation<input type="number" step="1" data-part-transform="rotation" aria-label="Rotation in degrees" value="${number(t.rotation)}"></label></div>
    ${t.uniform ? '' : `<p class="small" data-part-stretched>Wider than tall (${number(t.scaleX, 3)} × ${number(t.scaleY, 3)}): Scale keeps that proportion.</p>`}`;
}

function palette(piece) {
  if (!piece.palette.length) return '<h4>Colours</h4><p class="small">No colours to change on this piece.</p>';
  const shown = piece.palette.slice(0, PALETTE_LIMIT), rest = piece.palette.length - shown.length;
  return `<h4>Colours</h4><div class="part-palette" role="list" aria-label="Colours">${shown.map((entry) => `<button type="button" role="listitem" class="paint-swatch part-swatch" data-part-colour="${esc(entry.colour)}" style="--swatch:${esc(entry.colour)}" aria-label="Colour ${esc(entry.colour)}, used ${entry.count} time${entry.count === 1 ? '' : 's'}" title="${esc(entry.colour)} · ${entry.count} use${entry.count === 1 ? '' : 's'} · click to change"></button>`).join('')}${rest > 0 ? `<span class="small">+${rest} more</span>` : ''}</div><p class="small">A swatch changes that colour everywhere this piece uses it.</p>`;
}

function shape(piece) {
  const what = piece.nodeKind === 'g' ? 'Opens Artwork on this group, with the vector tools and every piece inside it.' : piece.nodeKind === 'path' ? 'Opens the Node tool on this piece, in Artwork: drag its points and curves.' : 'Opens Artwork on this piece; the Node tool turns it into a path to reshape.';
  return `<h4>Shape</h4><button type="button" data-part-edit-shape aria-label="Edit the shape of ${esc(piece.label)}">✎ Edit Shape</button><p class="small">${what}</p>`;
}

function markup(model, sections) {
  if (!model.loaded) return '<p class="part-empty" data-part-inspector-empty>Start from a preset, or import artwork, to build a character.</p>';
  if (model.kind === 'empty') return '<p class="part-empty" data-part-inspector-empty>Pick a part on the left, or click the mascot.</p>';
  if (model.kind === 'category') {
    const category = model.category;
    const action = category.status === 'missing' && category.part ? '<button type="button" class="secondary" data-character-route="face-setup">Assign it in Face Setup…</button>'
      : category.kind === 'hands' && category.status === 'missing' ? '<button type="button" class="secondary" data-character-route="hand-setup">Draw a pair of hands…</button>'
        : category.kind === 'presets' ? '<p class="small">Choose a face on the left. Every part of it can then be moved, resized and recoloured here.</p>'
          : category.kind === 'palette' ? paletteRowsMarkup(model.palette) : '';
    return `${subject(model)}<p class="small" data-part-category-note>${esc(category.summary)}</p>${action}`;
  }
  const piece = model.piece;
  const advanced = disclosureSection({
    id: 'advanced', level: 'advanced', title: 'Advanced', hint: 'rig and artwork', open: sections.has('advanced', false),
    body: `<p class="small">The same piece, with every control: the movements it plays in Face Setup, and its bindings and appearance in the Artwork inspector.</p><div class="action-row">${piece.partId ? '<button type="button" class="secondary" data-character-route="face-part">Face part setup</button>' : ''}<button type="button" class="secondary" data-character-route="artwork">Artwork inspector</button></div>`
  });
  return `${subject(model)}<p class="small" data-part-piece-name>${esc(piece.label)}${piece.roleLabel && piece.roleLabel !== piece.label ? ` · ${esc(piece.roleLabel)}` : ''}</p>${pieceChips(model)}${piece.hand ? handPlacementMarkup(piece.hand) : transformFields(piece)}${palette(piece)}${shape(piece)}${advanced}`;
}

/**
 * @param {HTMLElement} host
 * @param {object} options
 * @param {() => object} options.view the rich model the builder derives
 * @param {(id: string, key: string, value: number) => void} [options.onTransform]
 * @param {(id: string, value: number) => void} [options.onScale]
 * @param {(id: string, value: number) => void} [options.onSpacing]  the distance between a pair's two
 * @param {(on: boolean) => void} [options.onLinked]  edit both sides of the pair as one, or not
 * @param {(id: string) => void} [options.onPiece]
 * @param {(id: string, colour: string) => void} [options.onColour]
 * @param {(token: string) => void} [options.onToken]  a colour of the whole face
 * @param {(id: string) => void} [options.onEditShape]
 * @param {(route: string) => void} [options.onRoute]
 */
export function createPartInspector(host, { view = () => ({ loaded: false, kind: 'empty' }), onTransform = () => {}, onScale = () => {}, onSpacing = () => {}, onLinked = () => {}, onPiece = () => {}, onColour = () => {}, onToken = () => {}, onEditShape = () => {}, onRoute = () => {} } = {}) {
  if (!host) throw new Error('Missing required UI element: #part-inspector');
  // The panel rebuilds on every edit; the Advanced disclosure the author opened
  // must not fold on the next keystroke.
  const sections = rememberOpen(host);
  let shown = null;
  let pending = false;
  const pieceId = () => shown?.piece?.id || null;
  const focusInside = () => {
    const active = globalThis.document?.activeElement;
    return Boolean(active && active !== host && typeof host.contains === 'function' && host.contains(active));
  };

  const component = createComponent({
    host,
    // The rich model rides along under its signature; the signature is what
    // decides whether the panel is redrawn.
    equal: (a, b) => a?.signature === b?.signature,
    onMount: ({ listen }) => {
      listen(host, 'change', (event) => {
        const field = event.target, id = pieceId();
        if (!id || !field?.dataset) return;
        if (field.dataset.partTransform) onTransform(id, field.dataset.partTransform, Number(field.value));
        else if (field.dataset.partScale !== undefined) onScale(id, Number(field.value));
        else if (field.dataset.partSpacing !== undefined) onSpacing(id, Number(field.value));
        // A tick is a click, not a field being typed in: the panel redraws
        // under it at once, or the Spacing field it takes away would linger.
        else if (field.dataset.partLinked !== undefined) { onLinked(Boolean(field.checked)); redraw(); }
      });
      listen(host, 'click', (event) => {
        const button = event.target?.closest?.('button');
        if (!button) return;
        const { partPiece, partColour, faceToken, partEditShape, characterRoute } = button.dataset || {};
        if (partPiece) onPiece(partPiece);
        else if (partColour) onColour(pieceId(), partColour);
        else if (faceToken) onToken(faceToken);
        else if (partEditShape !== undefined) onEditShape(pieceId());
        else if (characterRoute) onRoute(characterRoute);
      });
      // The render the panel owed while a field had focus, once focus leaves it.
      listen(host, 'focusout', (event) => {
        const next = event.relatedTarget;
        if (pending && !(next && typeof host.contains === 'function' && host.contains(next))) { pending = false; render(); }
      });
    },
    render: (model) => {
      shown = model.rich;
      setPanelHtml(host, markup(model.rich, sections));
      host.dataset.partKind = model.rich.kind || 'empty';
      host.dataset.partPiece = model.rich.piece?.id || '';
    }
  });

  const flatten = (rich) => ({ signature: JSON.stringify(rich), rich });

  /** The panel drawn now, focus or no focus. */
  function redraw() {
    pending = false;
    const model = flatten(view());
    return component.isMounted() ? component.update(model) : component.mount(model);
  }

  /** @returns {boolean} whether anything was drawn */
  function render() {
    if (focusInside()) { pending = true; return false; }
    return redraw();
  }

  return { render, destroy: () => component.destroy(), counters: () => component.counters(), shown: () => shown };
}
