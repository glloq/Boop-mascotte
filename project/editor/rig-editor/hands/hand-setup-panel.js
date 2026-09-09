/**
 * Hand Setup panel (docs/HAND_RIGGING.md, docs/HAND_STYLES.md).
 *
 * ```text
 * Left hand
 *   Artwork · Anchored to · Anchor XY      basic: where the hand is
 *   Hand style  [▣ ▣ ▣ ▣ ▣ ▣]             basic: which drawing it is
 * ▸ Motion                                 more:  rest, reach, turn range
 * ▸ Physics                                more:  overshoot, cartoon lag
 * ▸ Advanced                               depth, and the offer to convert
 * ```
 *
 * There is nothing here for a finger, a curl, a grip, a facing axis or a pose
 * table: a hand is one of six whole drawings, and the only thing that changes
 * its shape is which drawing it is. Everything else about a hand is where it
 * is, how far it is turned, how big it is and whether it is on screen.
 *
 * The panel owns no hand data: it reads the `hands` block and writes through
 * atomic commands, so undo and redo work without it participating.
 */
import { createHandCommands } from '../../core/hands/hand-commands.js';
import { handReachEllipse, HAND_SIDES } from '../../core/hands/hand-model.js';
import { handShowParameter, installedHandLook, isHandHidden } from '../../core/sample/hand-feature.js';
import { DEFAULT_HAND_LOOK, HAND_LOOKS, HAND_STYLE_PIVOT, HAND_STYLE_VIEW_BOX_ATTRIBUTE, handStyleThumbnail } from '../../core/hands/hand-style-art.js';
import { hasHandStyles, isLegacyPseudo3DHand } from '../../core/hands/hand-style-install.js';
import { handStylePresets } from '../../core/puppet/hand-handles.js';
import { disclosurePanel } from '../../ui/disclosure.js';
import { rememberOpen } from '../../ui/panel-render.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const SIDE_LABEL = { left: 'Left hand', right: 'Right hand' };

/** The steps in order, so the panel can say what to do next rather than only what is wrong. */
export function handSetupSteps(hand, elements = {}) {
  if (!hand?.element) return { done: 0, next: 'Choose the artwork that draws this hand.' };
  if (elements && !elements[hand.element]) return { done: 0, next: 'Its artwork no longer exists. Choose another.' };
  if (!hand.parent) return { done: 1, next: 'Choose the body part the hand hangs from.' };
  if (hand.anchor.x === 0 && hand.anchor.y === 0) return { done: 2, next: 'Place the anchor point on the body.' };
  // A hand shows a drawing; a hand with no drawings can still be moved, but it
  // cannot change shape, and that is worth saying once.
  if (!hand.styles) return { done: 3, next: 'Give it drawings, so it has a style to show.' };
  return { done: 4, next: 'Ready. Test it from Preview.' };
}

export function createHandSetupPanel(host, store, history, { onSelect = () => {}, artboardWidth = () => 0, measure = () => null, applyPose = () => {}, liveValues = () => ({}), drawHands = null, handsDrawn = () => false, showHandRig = () => {}, useHandStyles = null } = {}) {
  if (!host) throw new Error('Missing required UI element: #hand-setup');
  // The card rebuilds on every hand edit — ticking "cartoon lag" inside Physics
  // must not close Physics.
  const sections = rememberOpen(host);
  const commands = createHandCommands(store, history);
  let notice = null;
  let openSide = 'left';
  let drawLook = DEFAULT_HAND_LOOK;
  const doc = () => store.getDocument();
  const say = (tone, text) => { notice = { tone, text }; };
  // A hand that rests behind the head comes out to be looked at: anything that
  // changes it here raises its show parameter too, so the author sees what they
  // asked for rather than the back of a head.
  const show = (side, values = {}) => applyPose(isHandHidden(doc(), side) ? { [handShowParameter(side)]: 1, ...values } : values);

  const artworkOptions = (selected) => Object.keys(doc().elements || {})
    .map((id) => `<option value="${esc(id)}"${id === selected ? ' selected' : ''}>${esc(doc().layerMetadata?.[id]?.name || id)}</option>`).join('');

  host.addEventListener('click', (event) => {
    const chip = event.target.closest?.('[data-hand-style-chip]');
    if (chip) {
      const [side, id] = chip.dataset.handStyleChip.split(':');
      const style = handStylePresets(doc(), side).find((item) => item.id === id);
      if (style?.added) { show(side, style.values); say('ok', `${style.name}.`); }
      else if (style) say('warn', `${style.name} is not drawn on this hand yet. Press it in the picker beside the face on the canvas to draw it.`);
      render();
      return;
    }
    const button = event.target.closest('button');
    if (!button) return;
    const { handAction, handSide } = button.dataset;
    if (!handAction) return;
    const side = handSide || openSide;
    if (handAction === 'draw') { if (drawHands?.(drawLook)) say('ok', 'Two hands drawn and rigged: six drawings each. Pick one below, then move and turn the hand.'); }
    if (handAction === 'use-styles') {
      if (useHandStyles?.(side)) say('ok', 'This hand shows drawings now. Pick one below; the fingers, the curls and the palm-to-side turn are gone.');
      else say('warn', 'Set the hand up first, then give it drawings.');
    }
    if (handAction === 'open') { openSide = side; notice = null; show(side); }
    if (handAction === 'remove') { commands.remove(side); say('ok', `${SIDE_LABEL[side]} removed.`); }
    // "Show on canvas" shows the *hand*, not only its anchor: a pair that rests
    // behind the head is a pair an author would be setting up blind.
    if (handAction === 'select') { onSelect(doc().hands?.[side]?.element || null); show(side); }
    if (handAction === 'mirror') {
      const width = Number(artboardWidth()) || 0;
      if (commands.mirror(side, { mirrorX: width / 2 })) say('ok', `Copied to the ${side === 'left' ? 'right' : 'left'}.`);
      else say('warn', 'Set this hand up first, then mirror it.');
    }
    render();
  });

  host.addEventListener('change', (event) => {
    const field = event.target;
    const { handField, handSide } = field.dataset;
    if (field.dataset.handLook !== undefined) { drawLook = HAND_LOOKS[field.value] ? field.value : DEFAULT_HAND_LOOK; return; }
    if (!handField) return;
    const side = handSide || openSide;
    const value = field.type === 'checkbox' ? field.checked : field.value;
    if (handField === 'artwork') {
      if (!value) return;
      // The anchor is where the hand hangs from, and its reach is drawn around
      // it: default both to the artwork itself, so a new hand can be dragged
      // straight away instead of needing four numbers first.
      const box = measure(String(value));
      const placement = box && Number.isFinite(box.width) && box.width
        ? { anchor: { x: box.x + box.width / 2, y: box.y + box.height / 2 }, reach: { x: Math.max(12, box.width * 1.5), y: Math.max(12, box.height * 1.5) } }
        : {};
      if (commands.assign(side, { element: String(value), ...placement })) {
        say('ok', box ? `${SIDE_LABEL[side]} uses this artwork. Drag it on the canvas, or adjust its anchor below.` : `${SIDE_LABEL[side]} uses this artwork. Place its anchor next.`);
      } else say('warn', 'That artwork cannot be used as a hand.');
    }
    if (handField === 'parent') commands.setParent(side, String(value) || null);
    if (handField === 'anchorX') commands.setAnchor(side, { ...doc().hands[side].anchor, x: Number(value) });
    if (handField === 'anchorY') commands.setAnchor(side, { ...doc().hands[side].anchor, y: Number(value) });
    if (handField === 'restX') commands.setRestOffset(side, { ...doc().hands[side].restOffset, x: Number(value) });
    if (handField === 'restY') commands.setRestOffset(side, { ...doc().hands[side].restOffset, y: Number(value) });
    if (handField === 'reachX') commands.setReach(side, { x: Number(value) });
    if (handField === 'reachY') commands.setReach(side, { y: Number(value) });
    if (handField === 'reachRotation') commands.setReach(side, { rotation: Number(value) });
    if (handField === 'depth') commands.setDepth(side, Number(value));
    if (handField === 'softness') commands.setSoftness(side, Number(value));
    if (handField === 'inertia') commands.setInertia(side, { enabled: Boolean(value) });
    if (handField === 'restStyle') { if (commands.setStyles(side, { showing: String(value) })) say('ok', 'This hand rests on that drawing now.'); }
    if (handField === 'swap') { commands.setStyles(side, { swap: String(value) }); }
    if (handField === 'hidden') {
      if (commands.setHidden(side, Boolean(value), { measure })) say('ok', value ? 'Tucked behind the head. The slider beside the face brings it out, and so do a reaction, the Wave, or mascot.showHands().' : 'Out in the open at rest.');
      else say('warn', 'Choose the artwork first, so there is a hand to tuck away.');
    }
    render();
  });

  /* ── Which drawing (docs/HAND_STYLES.md) ─────────────────────────────────── */

  /**
   * A thumbnail of one drawing, from the same art the hand itself is drawn
   * from.
   *
   * The whole point of a picker is to catch a drawing that is bigger, shifted
   * or facing the wrong way, so it has to be the drawing itself and not a name
   * or an icon standing in for one.
   */
  const thumbnail = (side, style) =>
    `<svg viewBox="${HAND_STYLE_VIEW_BOX_ATTRIBUTE}" class="hand-thumb" aria-hidden="true" focusable="false">`
    // Id-free: a thumbnail is a picture of a drawing the document already
    // carries, and two nodes with one id is one node as far as anything
    // looking for it is concerned.
    + handStyleThumbnail(side, style, { at: { x: HAND_STYLE_PIVOT[0], y: HAND_STYLE_PIVOT[1] }, size: 2 * HAND_STYLE_PIVOT[0] * 0.86, look: installedHandLook(doc()) })
    + '</svg>';

  /**
   * One row of drawings, and that row is the whole choice: a hand **is** one of
   * them. A drawing the hand has not been given yet is shown as an offer, so
   * the row says what the library holds as well as what this hand has.
   */
  function stylesFor(side) {
    const state = doc();
    const hand = state.hands?.[side];
    const styles = handStylePresets(state, side);
    if (!hand?.styles || !styles.length) return '';
    const live = liveValues();
    const parameter = hand.parameters.style;
    const index = Math.round(Number(live[parameter] ?? state.params?.[parameter]?.default ?? 0));
    const showing = hand.styles.library[Math.max(0, Math.min(hand.styles.library.length - 1, index))]?.id;
    const row = `<div class="pose-chips hand-pose-strip">${styles.map((style) => `<button type="button"
      class="chip pose-chip hand-thumb-chip${style.id === showing ? ' chip-active' : ''}${style.added ? '' : ' chip-offer'}"
      data-hand-style-chip="${side}:${esc(style.id)}" aria-pressed="${style.id === showing}"
      title="${esc(style.added ? style.name : `${style.name} — not drawn on this hand yet`)}">${thumbnail(side, style.id)}<span>${esc(style.name)}</span></button>`).join('')}</div>`;
    const rest = `<label class="small">Rests on
      <select data-hand-field="restStyle" data-hand-side="${side}" aria-label="${SIDE_LABEL[side]} resting drawing">${hand.styles.library
        .map((style) => `<option value="${esc(style.id)}"${style.id === hand.styles.showing ? ' selected' : ''}>${esc(style.label)}</option>`).join('')}</select></label>`;
    return `${row}${rest}
      <p class="small">A drawing never bends: the hand moves, turns and resizes as a whole, and a change of drawing is a change of picture. Keyframe it from the timeline and it steps rather than blending.</p>`;
  }

  /**
   * The offer to convert a hand that still deforms (docs/HAND_STYLES.md).
   *
   * It says what it will do, because it is not reversible by pressing it
   * again -- it is reversible by undo, and by making the parts visible again.
   */
  function convertFor(side) {
    if (!useHandStyles || hasHandStyles(doc(), side)) return '';
    const legacy = isLegacyPseudo3DHand(doc(), side);
    return `<div class="hand-actions" data-hand-convert="${side}">
        <button type="button" class="secondary" data-hand-action="use-styles" data-hand-side="${side}">Use static drawings</button>
      </div>
      <p class="small">${legacy
        ? 'This hand turns by deforming six parts, which wobbles while it moves. Static drawings replace that: six whole pictures, chosen rather than blended, with nothing inside them that moves. The parts are hidden, not deleted — undo, or make them visible again.'
        : 'Six whole drawings, chosen rather than blended. Nothing inside one of them ever moves.'}</p>`;
  }

  function renderHand(side) {
    const state = doc();
    const hand = state.hands?.[side];
    const open = side === openSide;
    if (!hand) {
      // Nothing to configure yet: one line, one choice. The explanation lives
      // once at the top of the panel rather than inside each empty card.
      return `<section class="hand-card" data-hand-card="${side}" data-hand-status="empty">
        <h4>${SIDE_LABEL[side]} <small>not set up</small></h4>
        <label class="small">Artwork
          <select data-hand-field="artwork" data-hand-side="${side}" aria-label="${SIDE_LABEL[side]} artwork">
            <option value="">Choose artwork…</option>${artworkOptions('')}
          </select>
        </label>
      </section>`;
    }
    const steps = handSetupSteps(hand, state.elements);
    const ellipse = handReachEllipse(hand, state.elements);
    const key = (name) => `hand:${side}:${name}`;
    // Where the hand is: the three things `handSetupSteps` walks the author
    // through, and nothing else.
    const place = `<label class="small">Artwork
        <select data-hand-field="artwork" data-hand-side="${side}">${artworkOptions(hand.element)}</select>
      </label>
      <label class="small">Anchored to
        <select data-hand-field="parent" data-hand-side="${side}"><option value="">Nothing (fixed)</option>${artworkOptions(hand.parent || '')}</select>
      </label>
      <div class="hand-fields">
        <label class="small">Anchor X<input type="number" step="0.5" data-hand-field="anchorX" data-hand-side="${side}" value="${hand.anchor.x}"></label>
        <label class="small">Anchor Y<input type="number" step="0.5" data-hand-field="anchorY" data-hand-side="${side}" value="${hand.anchor.y}"></label>
      </div>
      <label class="small" data-hand-hidden="${side}"><input type="checkbox" data-hand-field="hidden" data-hand-side="${side}"${isHandHidden(state, side) ? ' checked' : ''}> Rests behind the head, out on request</label>
      <p class="small">${isHandHidden(state, side) ? 'Out of sight until the slider beside the face on the canvas, a reaction, the Wave or the page asks (<code>mascot.showHands()</code>). Choosing a drawing here brings it out to look at.' : 'In the open at rest. Tick to keep it behind the head until something asks for it.'}</p>`;
    // The rest offset and the reach draw one picture — the ellipse is centred
    // on anchor + rest — so they are one section, with the readout under them.
    const motion = `<div class="hand-fields">
        <label class="small">Rest X<input type="number" step="0.5" data-hand-field="restX" data-hand-side="${side}" value="${hand.restOffset.x}"></label>
        <label class="small">Rest Y<input type="number" step="0.5" data-hand-field="restY" data-hand-side="${side}" value="${hand.restOffset.y}"></label>
        <label class="small">Reach across<input type="number" step="1" min="1" data-hand-field="reachX" data-hand-side="${side}" value="${hand.reach.x}"></label>
        <label class="small">Reach up<input type="number" step="1" min="1" data-hand-field="reachY" data-hand-side="${side}" value="${hand.reach.y}"></label>
        <label class="small">Turn range<input type="number" step="1" data-hand-field="reachRotation" data-hand-side="${side}" value="${hand.reach.rotation}"></label>
      </div>
      <p class="small" data-hand-reach>${ellipse ? `Reach: ${round(ellipse.rx)} × ${round(ellipse.ry)} around (${round(ellipse.cx)}, ${round(ellipse.cy)})` : ''}</p>
      <p class="small">A static drawing carries a small turn well and a large one badly. Around ±30° reads as a hand turning; much past that reads as a picture rotating, because it is one.</p>`;
    // Both of these are feel, not geometry: how softly the reach limit gives,
    // and whether the hand lags behind where it is asked to be.
    const physics = `<label class="small">Overshoot<input type="range" min="0" max="1" step="0.05" data-hand-field="softness" data-hand-side="${side}" value="${hand.softness}"></label>
      <label class="small"><input type="checkbox" data-hand-field="inertia" data-hand-side="${side}"${hand.inertia.enabled ? ' checked' : ''}> A little cartoon lag</label>`;
    // Draw order, when a drawing changes, and the offer to convert an older
    // hand: the wiring an author should never have to meet before they want to.
    const swap = hand.styles ? `<label class="small">Change the drawing
        <select data-hand-field="swap" data-hand-side="${side}" aria-label="When the drawing changes">
          <option value="cut"${hand.styles.swap === 'cut' ? ' selected' : ''}>At once</option>
          <option value="hidden"${hand.styles.swap === 'hidden' ? ' selected' : ''}>Only while out of sight</option>
        </select></label>
      <p class="small">A change of drawing is a swap, never a blend. "Only while out of sight" holds it until the hand is hidden or off the artboard, which is the swap nobody sees.</p>` : '';
    const advanced = `${convertFor(side)}<label class="small">Depth<input type="range" min="-1" max="1" step="0.05" data-hand-field="depth" data-hand-side="${side}" value="${hand.depth}"></label>${swap}`;
    return `<section class="hand-card" data-hand-card="${side}" data-hand-status="${steps.done === 4 ? 'ready' : 'setup'}" data-hand-step="${steps.done}">
      <h4><button type="button" data-hand-action="open" data-hand-side="${side}" aria-expanded="${open}">${SIDE_LABEL[side]}</button></h4>
      <p class="small" data-hand-next>${esc(steps.next)}</p>
      ${open ? `${disclosurePanel([
        { id: key('place'), level: 'basic', body: place },
        ...(hasHandStyles(state, side) ? [{ id: key('styles'), level: 'basic', title: 'Hand style', body: stylesFor(side) }] : []),
        { id: key('motion'), level: 'more', title: 'Motion', hint: ellipse ? `${round(ellipse.rx)} × ${round(ellipse.ry)}` : '', open: sections.has(key('motion')), body: motion },
        { id: key('physics'), level: 'more', title: 'Physics', hint: hand.inertia.enabled ? 'cartoon lag on' : '', open: sections.has(key('physics')), body: physics },
        { id: key('advanced'), level: 'advanced', title: 'Advanced', hint: hand.styles ? `${hand.styles.library.length} drawings` : 'no drawings', open: sections.has(key('advanced')), body: advanced }
      ])}
      <div class="hand-actions">
        <button type="button" class="secondary" data-hand-action="select" data-hand-side="${side}">Show on canvas</button>
        <button type="button" class="secondary" data-hand-action="mirror" data-hand-side="${side}">Mirror to the other side</button>
        <button type="button" class="secondary" data-hand-action="remove" data-hand-side="${side}">Remove</button>
      </div>` : ''}
    </section>`;
  }

  function render() {
    host.dataset.handSetupReady = 'true';
    host.dataset.handSetupCount = String(HAND_SIDES.filter((side) => doc().hands?.[side]).length);
    // Nothing to rig until something is drawn, and "draw a hand somewhere else
    // and import it" is where this feature used to end for most people.
    const offer = drawHands && !handsDrawn() ? `<div class="hand-actions"><button type="button" data-hand-action="draw" data-hand-side="left">✋ Draw a pair of hands</button>
        <label class="small">Look <select data-hand-look aria-label="Hand look">${Object.values(HAND_LOOKS).map((look) => `<option value="${look.id}"${look.id === drawLook ? ' selected' : ''}>${esc(look.name)}</option>`).join('')}</select></label></div>
      <p class="small">Cartoon hands, drawn whole rather than deformed: relaxed, open, a fist, a pointing finger, a thumbs up and a V — one static drawing each, rigged to the head with a Wave to try. Nothing inside a hand ever moves (<a href="../../docs/HAND_STYLES.md">how hands work</a>).</p>` : '';
    host.innerHTML = `<p class="small">Two floating hands, Rayman style: no arms, no bones, no elbows. Pick artwork for a hand and it hangs off an anchor on the body, following it while keeping its own movement.</p>
      ${offer}
      ${HAND_SIDES.map(renderHand).join('')}
      ${notice ? `<p class="workspace-hint" data-tone="${notice.tone}" role="status">${esc(notice.text)}</p>` : ''}`;
    // The canvas draws this hand's anchor and reach while the panel is on
    // screen with a side open (VNX-19). `checkVisibility` is what makes it "on
    // screen" rather than "whenever the Rig workspace is showing".
    showHandRig(host.checkVisibility?.() && doc().hands?.[openSide] ? openSide : null);
  }

  return { render, getOpenSide: () => openSide, openHand(side) { openSide = side; render(); } };
}

function round(value) { return Math.round((Number(value) || 0) * 100) / 100; }
