/**
 * Hand Setup panel (docs/HAND_RIGGING.md).
 *
 * ```text
 * Left hand
 *   Artwork · Anchored to · Anchor XY      basic: where the hand is
 *   Poses   [chips]                        basic: what it can do
 * ▸ Fingers                                more:  the rig under a pose
 * ▸ Motion                                 more:  rest, reach, turn range
 * ▸ Physics                                more:  overshoot, cartoon lag
 * ▸ Advanced                               depth, shape keys, variants
 * ```
 *
 * VNX-12: the card used to show all nine numeric fields, the curls, the pose
 * wiring and three buttons at once, which is a wall, not a workflow. The tiers
 * hide nothing — every control is one click away — they say which of them the
 * setup steps actually ask for.
 *
 * The panel owns no hand data: it reads the `hands` block and writes through
 * atomic commands, so undo and redo work without it participating.
 */
import { createHandCommands } from '../../core/hands/hand-commands.js';
import { SUGGESTED_HAND_POSES, handReachEllipse, HAND_SIDES } from '../../core/hands/hand-model.js';
import { handPosePresets } from '../../core/puppet/hand-handles.js';
import {
  HAND_DIGIT_CONTROLS, HAND_FACING_STOPS, handDigitParameter, handFacingParameter, handShowParameter, installedHandStyle, isGeneratedHand, isHandHidden, poseIdFromName
} from '../../core/sample/hand-feature.js';
import { HAND_DEFAULT_STYLE, HAND_DIGITS, HAND_POSE_TABLES, HAND_PROFILE_POSE_TABLES, HAND_STYLES, aimDigit, digitTip, handPartCaps, handParts, handPoseTable } from '../../core/sample/hand-artwork.js';
import { hasHandSet } from '../../core/sample/hand-set.js';
import { disclosurePanel } from '../../ui/disclosure.js';
import { rememberOpen } from '../../ui/panel-render.js';
import { poseChipRow } from '../../ui/pose-chips.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const SIDE_LABEL = { left: 'Left hand', right: 'Right hand' };

/* ── Pose editor (docs/HAND_REPRESENTATIONS_STUDY.md, stage 3) ─────────────
 *
 * A generated hand is drawn from numbers -- per digit `{ curl, bend, angle,
 * length, width }`, the palm's width -- so a pose is edited as numbers and
 * captured as the keys the runtime plays. No node editing, and no way to author
 * a pose whose layout does not match the hand it deforms.
 */

/** What each slider moves, and how far. */
export const HAND_EDITOR_FIELDS = Object.freeze([
  Object.freeze({ id: 'curl', label: 'Curl', min: 0, max: 1, step: 0.05, hint: 'fold the finger away' }),
  Object.freeze({ id: 'bend', label: 'Bend', min: -230, max: 90, step: 2, hint: 'hook it sideways, in degrees' }),
  Object.freeze({ id: 'angle', label: 'Angle', min: -120, max: 120, step: 1, hint: 'where it points' }),
  Object.freeze({ id: 'length', label: 'Length', min: 4, max: 32, step: 0.5, hint: '' }),
  Object.freeze({ id: 'width', label: 'Width', min: 3, max: 10, step: 0.1, hint: '' })
]);
export const HAND_EDITOR_PALM_FIELDS = Object.freeze([
  Object.freeze({ id: 'hw', label: 'Palm width', min: 7, max: 24, step: 0.5, hint: 'a narrow palm is a profile' })
]);
const EDITOR_DIGITS = Object.freeze([...HAND_DIGITS, Object.freeze({ id: 'palm', name: 'Palm' })]);
const EDITOR_VIEWS = Object.freeze([
  Object.freeze({ id: 'front', name: 'Palm view', view: 'front' }),
  Object.freeze({ id: 'profile', name: 'Side view', view: 'profile' })
]);
const round2 = (value) => Math.round(Number(value) * 100) / 100;

/** The steps in order, so the panel can say what to do next rather than only what is wrong. */
export function handSetupSteps(hand, elements = {}) {
  if (!hand?.element) return { done: 0, next: 'Choose the artwork that draws this hand.' };
  if (elements && !elements[hand.element]) return { done: 0, next: 'Its artwork no longer exists. Choose another.' };
  if (!hand.parent) return { done: 1, next: 'Choose the body part the hand hangs from.' };
  if (hand.anchor.x === 0 && hand.anchor.y === 0) return { done: 2, next: 'Place the anchor point on the body.' };
  if (!hand.poses.length) return { done: 3, next: 'Add a pose, such as Wave — optional, but it is what makes a hand act.' };
  return { done: 4, next: 'Ready. Test it from Preview.' };
}

export function createHandSetupPanel(host, store, history, { onSelect = () => {}, artboardWidth = () => 0, measure = () => null, applyPose = () => {}, liveValues = () => ({}), drawHands = null, handsDrawn = () => false, showHandRig = () => {}, useHandSet = null, importHandSet = null } = {}) {
  if (!host) throw new Error('Missing required UI element: #hand-setup');
  // The card rebuilds on every hand edit — ticking "cartoon lag" inside Physics
  // must not close Physics.
  const sections = rememberOpen(host);
  const commands = createHandCommands(store, history);
  let notice = null;
  let openSide = 'left';
  let drawStyle = HAND_DEFAULT_STYLE;
  /** The pose being edited on each side: numbers in hand until Capture writes them. */
  const editors = { left: null, right: null };
  const freshEditor = (side, poseId) => {
    const pose = poseId ? (doc().hands?.[side]?.poses || []).find((item) => item.id === poseId) : null;
    return {
      poseId: pose?.id || null, name: pose?.name || '',
      table: structuredClone(pose?.table || (pose && HAND_POSE_TABLES[pose.id]) || {}),
      profileTable: pose ? structuredClone(pose.profileTable || HAND_PROFILE_POSE_TABLES[pose.id] || null) : null,
      view: 'front', digit: 'index'
    };
  };
  const editorOf = (side) => { editors[side] ||= freshEditor(side, null); return editors[side]; };
  /** The table the current view edits -- the profile one is made on first touch. */
  const editedTable = (editor) => (editor.view === 'front' ? editor.table : (editor.profileTable ||= {}));
  const setDigitField = (editor, digit, field, value) => {
    const table = editedTable(editor);
    if (digit === 'palm') {
      if (field === 'heel') table.heel = value ? 1 : 0;
      else table.palm = { ...(table.palm || {}), [field]: value };
      return;
    }
    table.digits ||= {};
    table.digits[digit] = { ...(table.digits[digit] || {}), [field]: value };
  };
  const doc = () => store.getDocument();
  const say = (tone, text) => { notice = { tone, text }; };
  // A hand that rests behind the head comes out to be posed: anything that
  // poses it here raises its show parameter along with the pose, so the author
  // sees what they asked for rather than the back of a head.
  const show = (side, values = {}) => applyPose(isHandHidden(doc(), side) ? { [handShowParameter(side)]: 1, ...values } : values);

  const artworkOptions = (selected) => Object.keys(doc().elements || {})
    .map((id) => `<option value="${esc(id)}"${id === selected ? ' selected' : ''}>${esc(doc().layerMetadata?.[id]?.name || id)}</option>`).join('');

  host.addEventListener('click', (event) => {
    if (handleEditorClick(event)) { render(); return; }
    const view = event.target.closest?.('[data-hand-view-chip]');
    if (view) {
      const [side, id] = view.dataset.handViewChip.split(':');
      const stop = HAND_FACING_STOPS.find((item) => item.id === id);
      if (stop) show(side, { [handFacingParameter(side)]: stop.value });
      render();
      return;
    }
    const chip = event.target.closest?.('[data-hand-pose-chip]');
    if (chip) {
      const [side, id] = chip.dataset.handPoseChip.split(':');
      const pose = handPosePresets(doc(), side).find((item) => item.id === id);
      if (pose?.added) { show(side, pose.values); say(pose.ready ? 'ok' : 'warn', pose.ready ? `${pose.name}.` : `${pose.name} has no shape or artwork yet, so nothing moves. Give it one below.`); }
      else { const preset = SUGGESTED_HAND_POSES.find((item) => item.id === id); if (preset && commands.addPose(side, preset)) say('ok', `${preset.name} added. Give it a shape key or its own artwork.`); }
      render();
      return;
    }
    const button = event.target.closest('button');
    if (!button) return;
    const { handAction, handSide, handPose } = button.dataset;
    if (!handAction) return;
    const side = handSide || openSide;
    if (handAction === 'draw') { if (drawHands?.(drawStyle)) say('ok', 'Two hands drawn and rigged, with nine poses and a curl per finger ready to try.'); }
    if (handAction === 'open-hand') {
      show(side, Object.fromEntries([
        ...HAND_DIGIT_CONTROLS.map((digit) => [handDigitParameter(side, digit.id), 0]),
        ...(doc().hands?.[side]?.poses || []).map((pose) => [pose.parameter, 0])
      ]));
    }
    if (handAction === 'set') { if (useHandSet?.(side)) say('ok', 'A set of drawings added: every pose is a drawing the hand swaps to. Strike one below.'); else say('warn', 'Set the hand up first, then give it drawings.'); }
    if (handAction === 'open') { openSide = side; notice = null; show(side); }
    if (handAction === 'remove') { commands.remove(side); say('ok', `${SIDE_LABEL[side]} removed.`); }
    if (handAction === 'select') onSelect(doc().hands?.[side]?.element || null);
    if (handAction === 'remove-pose') commands.removePose(side, handPose);
    if (handAction === 'mirror') {
      const width = Number(artboardWidth()) || 0;
      if (commands.mirror(side, { mirrorX: width / 2 })) say('ok', `Copied to the ${side === 'left' ? 'right' : 'left'}.`);
      else say('warn', 'Set this hand up first, then mirror it.');
    }
    render();
  });

  host.addEventListener('change', (event) => {
    const field = event.target;
    const { handField, handSide, handPose } = field.dataset;
    if (field.dataset.handStyle !== undefined) { drawStyle = HAND_STYLES[field.value] ? field.value : HAND_DEFAULT_STYLE; return; }
    if (field.dataset.handEditorField !== undefined) { if (handleEditorChange(field)) render(); return; }
    if (field.dataset.handSetFile !== undefined) {
      const file = field.files?.[0];
      const side = field.dataset.handSetFile || openSide;
      if (file && importHandSet) Promise.resolve(importHandSet(side, file)).then((ok) => { if (ok) say('ok', 'Drawings imported: each is a pose of this hand now.'); render(); });
      return;
    }
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
    if (handField === 'hidden') {
      if (commands.setHidden(side, Boolean(value), { measure })) say('ok', value ? 'Tucked behind the head. A reaction, the Wave, or mascot.showHands() brings it out.' : 'Out in the open at rest.');
      else say('warn', 'Choose the artwork first, so there is a hand to tuck away.');
    }
    if (handField === 'poseShape') {
      const hand = doc().hands[side];
      const pose = hand.poses.find((item) => item.id === handPose);
      if (pose) commands.addPose(side, { ...pose, shapeKey: String(value) || null });
    }
    if (handField === 'poseVariant') {
      const hand = doc().hands[side];
      const pose = hand.poses.find((item) => item.id === handPose);
      if (pose) commands.addPose(side, { ...pose, variant: String(value) || null });
    }
    render();
  });

  host.addEventListener('input', (event) => {
    const finger = event.target.closest?.('[data-hand-finger]');
    if (finger) show(finger.dataset.handSide || openSide, { [finger.dataset.handFinger]: Number(finger.value) });
    const typed = event.target.closest?.('[data-hand-editor-field]');
    if (typed?.dataset.handEditorField === 'name') editorOf(typed.dataset.handSide || openSide).name = String(typed.value || '');
    const slider = event.target.closest?.('[data-hand-editor-slider]');
    if (slider) {
      // A slider fires while it is dragged: the numbers change and the preview
      // redraws in place; nothing is rebuilt, so the drag is never interrupted.
      const side = slider.dataset.handSide || openSide;
      const editor = editorOf(side);
      setDigitField(editor, editor.digit, slider.dataset.handEditorSlider, round2(slider.value));
      const preview = host.querySelector?.(`[data-hand-editor-preview="${side}"]`);
      if (preview) preview.outerHTML = previewFor(side, editor);
      const readout = host.querySelector?.(`[data-hand-editor-readout="${side}:${slider.dataset.handEditorSlider}"]`);
      if (readout) readout.textContent = String(round2(slider.value));
    }
  });

  /**
   * Pose select, name field, heel checkbox. Returns whether the card has to be
   * rebuilt: a name is only stored -- rebuilding on the blur that a press on
   * Capture causes would destroy the very button being pressed.
   */
  function handleEditorChange(field) {
    const side = field.dataset.handSide || openSide;
    if (field.dataset.handEditorField === 'pose') { editors[side] = freshEditor(side, String(field.value || '') || null); return true; }
    if (field.dataset.handEditorField === 'name') { editorOf(side).name = String(field.value || ''); return false; }
    if (field.dataset.handEditorField === 'heel') { setDigitField(editorOf(side), 'palm', 'heel', Boolean(field.checked)); return true; }
    return false;
  }

  /** Views, digits and the four actions. Returns whether the click was the editor's. */
  function handleEditorClick(event) {
    const viewChip = event.target.closest?.('[data-hand-editor-view]');
    if (viewChip) {
      const [side, id] = viewChip.dataset.handEditorView.split(':');
      editorOf(side).view = EDITOR_VIEWS.some((item) => item.id === id) ? id : 'front';
      return true;
    }
    const digitChip = event.target.closest?.('[data-hand-editor-digit]');
    if (digitChip) {
      const [side, id] = digitChip.dataset.handEditorDigit.split(':');
      editorOf(side).digit = EDITOR_DIGITS.some((item) => item.id === id) ? id : 'index';
      return true;
    }
    const button = event.target.closest?.('[data-hand-editor-action]');
    if (!button) return false;
    const side = button.dataset.handSide || openSide;
    const editor = editorOf(side);
    const action = button.dataset.handEditorAction;
    if (action === 'aim' && editor.digit !== 'palm' && editor.digit !== 'thumb') {
      // Bring this digit's tip onto the thumb's: an OK, a pinch, a snap.
      const view = EDITOR_VIEWS.find((item) => item.id === editor.view)?.view || 'front';
      const merged = handPoseTable(view, editedTable(editor));
      const aimed = aimDigit(merged.digits[editor.digit], digitTip(merged.digits.thumb));
      setDigitField(editor, editor.digit, 'angle', aimed.angle);
      setDigitField(editor, editor.digit, 'bend', aimed.bend);
      say('ok', `The ${editor.digit} now touches the thumb. Capture the pose to keep it.`);
    }
    if (action === 'reset') {
      const table = editedTable(editor);
      if (editor.digit === 'palm') { delete table.palm; delete table.heel; } else if (table.digits) delete table.digits[editor.digit];
    }
    if (action === 'capture') {
      const name = editor.name.trim() || (editor.poseId ? editor.poseId : 'Pose');
      const result = commands.capturePose(side, { id: editor.poseId || poseIdFromName(name), name, table: editor.table, profileTable: editor.profileTable });
      if (result) {
        editors[side] = freshEditor(side, result.id);
        // Strike it, so what was captured is what is on the mascot.
        show(side, { ...Object.fromEntries((doc().hands?.[side]?.poses || []).map((pose) => [pose.parameter, 0])), [result.parameter]: 1 });
        say('ok', `${name} captured: a shape key on every part it moves, ready to animate or use in a reaction.`);
      } else say('warn', 'That pose could not be captured. Draw a pair of hands first.');
    }
    if (action === 'drop' && editor.poseId) {
      const name = editor.name || editor.poseId;
      if (commands.dropPose(side, editor.poseId)) { editors[side] = null; say('ok', `${name} removed, with the shape keys it had.`); }
    }
    return true;
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
    const shapeOptions = (selected) => `<option value="">—</option>${(state.shapeKeys || []).filter((key) => key.target === hand.element)
      .map((key) => `<option value="${esc(key.id)}"${key.id === selected ? ' selected' : ''}>${esc(key.name || key.id)}</option>`).join('')}`;
    const key = (name) => `hand:${side}:${name}`;
    // Where the hand is and what it can do: the four things `handSetupSteps`
    // walks the author through, and nothing else.
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
      <p class="small">${isHandHidden(state, side) ? 'Out of sight until a reaction, the Wave or the page asks (<code>mascot.showHands()</code>). Posing it here brings it out to look at.' : 'In the open at rest. Tick to keep it behind the head until something asks for it.'}</p>`;
    // The rest offset and the reach draw one picture — the ellipse is centred
    // on anchor + rest — so they are one section, with the readout under them.
    const motion = `<div class="hand-fields">
        <label class="small">Rest X<input type="number" step="0.5" data-hand-field="restX" data-hand-side="${side}" value="${hand.restOffset.x}"></label>
        <label class="small">Rest Y<input type="number" step="0.5" data-hand-field="restY" data-hand-side="${side}" value="${hand.restOffset.y}"></label>
        <label class="small">Reach across<input type="number" step="1" min="1" data-hand-field="reachX" data-hand-side="${side}" value="${hand.reach.x}"></label>
        <label class="small">Reach up<input type="number" step="1" min="1" data-hand-field="reachY" data-hand-side="${side}" value="${hand.reach.y}"></label>
        <label class="small">Turn range<input type="number" step="1" data-hand-field="reachRotation" data-hand-side="${side}" value="${hand.reach.rotation}"></label>
      </div>
      <p class="small" data-hand-reach>${ellipse ? `Reach: ${round(ellipse.rx)} × ${round(ellipse.ry)} around (${round(ellipse.cx)}, ${round(ellipse.cy)})` : ''}</p>`;
    // Both of these are feel, not geometry: how softly the reach limit gives,
    // and whether the hand lags behind where it is asked to be.
    const physics = `<label class="small">Overshoot<input type="range" min="0" max="1" step="0.05" data-hand-field="softness" data-hand-side="${side}" value="${hand.softness}"></label>
      <label class="small"><input type="checkbox" data-hand-field="inertia" data-hand-side="${side}"${hand.inertia.enabled ? ' checked' : ''}> A little cartoon lag</label>`;
    // Draw order, shape keys and artwork variants: the wiring behind a pose,
    // which is exactly what the roadmap says an author should never have to
    // meet before they want to.
    // A drawing per pose, swapped in as the pose rises: the cut-out way, for
    // artwork of the author's own. The built-in set stands in for poses a hand
    // the generator did not draw cannot have; an SVG's drawings suit any hand.
    const drawings = useHandSet || importHandSet ? `<div class="hand-actions" data-hand-drawings="${side}">
        ${useHandSet && !isGeneratedHand(state, side) && !hasHandSet(state, side) ? `<button type="button" class="secondary" data-hand-action="set" data-hand-side="${side}">Use a set of drawings</button>` : ''}
        ${importHandSet ? `<label class="button secondary small">Import drawings…<input hidden type="file" accept=".svg,image/svg+xml" data-hand-set-file="${side}" aria-label="Import drawings for the ${SIDE_LABEL[side].toLowerCase()}"></label>` : ''}
      </div>
      <p class="small">A drawing per pose, swapped in as the pose rises. An SVG's top-level drawings become poses, named after their id or name when it is one the hand knows.</p>` : '';
    const advanced = `${drawings}<label class="small">Depth<input type="range" min="-1" max="1" step="0.05" data-hand-field="depth" data-hand-side="${side}" value="${hand.depth}"></label>
      <ul class="hand-poses">${hand.poses.map((pose) => `<li data-hand-pose="${esc(pose.id)}">
        <span>${esc(pose.name)}</span>
        <label class="small">Shape<select data-hand-field="poseShape" data-hand-side="${side}" data-hand-pose="${esc(pose.id)}">${shapeOptions(pose.shapeKey)}</select></label>
        <label class="small">Artwork<select data-hand-field="poseVariant" data-hand-side="${side}" data-hand-pose="${esc(pose.id)}"><option value="">—</option>${artworkOptions(pose.variant || '')}</select></label>
        <button type="button" class="secondary" data-hand-action="remove-pose" data-hand-side="${side}" data-hand-pose="${esc(pose.id)}" aria-label="Remove ${esc(pose.name)}">✕</button>
      </li>`).join('')}</ul>`;
    return `<section class="hand-card" data-hand-card="${side}" data-hand-status="${steps.done === 4 ? 'ready' : 'setup'}" data-hand-step="${steps.done}">
      <h4><button type="button" data-hand-action="open" data-hand-side="${side}" aria-expanded="${open}">${SIDE_LABEL[side]}</button></h4>
      <p class="small" data-hand-next>${esc(steps.next)}</p>
      ${open ? `${disclosurePanel([
        { id: key('place'), level: 'basic', body: place },
        { id: key('poses'), level: 'basic', title: 'Poses', body: posesFor(side) + viewsFor(side) },
        { id: key('fingers'), level: 'more', title: 'Fingers', open: sections.has(key('fingers')), body: fingersFor(side) },
        { id: key('editor'), level: 'more', title: 'Pose editor', hint: editors[side]?.poseId ? esc(editors[side].name || editors[side].poseId) : '', open: sections.has(key('editor')), body: editorFor(side) },
        { id: key('motion'), level: 'more', title: 'Motion', hint: ellipse ? `${round(ellipse.rx)} × ${round(ellipse.ry)}` : '', open: sections.has(key('motion')), body: motion },
        { id: key('physics'), level: 'more', title: 'Physics', hint: hand.inertia.enabled ? 'cartoon lag on' : '', open: sections.has(key('physics')), body: physics },
        { id: key('advanced'), level: 'advanced', title: 'Advanced', hint: hand.poses.length === 1 ? '1 pose' : `${hand.poses.length} poses`, open: sections.has(key('advanced')), body: advanced }
      ])}
      <div class="hand-actions">
        <button type="button" class="secondary" data-hand-action="select" data-hand-side="${side}">Show on canvas</button>
        <button type="button" class="secondary" data-hand-action="mirror" data-hand-side="${side}">Mirror to the other side</button>
        <button type="button" class="secondary" data-hand-action="remove" data-hand-side="${side}">Remove</button>
      </div>` : ''}
    </section>`;
  }

  /**
   * One curl per digit, when the hand has them.
   *
   * A pose is the whole hand at once; this is the rig underneath it. It is a
   * live control like the movement sliders, not authoring: it writes to the
   * preview, and an animation or a reaction is what makes it permanent.
   *
   * Returns nothing when the hand has no curl parameters, which drops the whole
   * *Fingers* section rather than offering an empty one.
   */
  function fingersFor(side) {
    const state = doc();
    const digits = HAND_DIGIT_CONTROLS.map((digit) => ({ ...digit, parameter: handDigitParameter(side, digit.id) }))
      .filter((digit) => state.params?.[digit.parameter]);
    if (!digits.length) return '';
    const live = liveValues();
    return `<div class="hand-fields" data-hand-fingers="${side}">${digits.map((digit) => `<label class="small">${esc(digit.name)}
      <input type="range" min="0" max="1" step="0.05" data-hand-finger="${esc(digit.parameter)}" data-hand-side="${side}" aria-label="${esc(digit.name)} curl" value="${Number(live[digit.parameter] || 0)}"></label>`).join('')}
      <button type="button" class="secondary" data-hand-action="open-hand" data-hand-side="${side}">Open the hand</button></div>`;
  }

  /** The hand as the editor's numbers draw it, in the view being edited. */
  function previewFor(side, editor) {
    const view = EDITOR_VIEWS.find((item) => item.id === editor.view)?.view || 'front';
    const parts = handParts(side, { view, pose: editor.view === 'front' ? editor.table : (editor.profileTable || {}), at: { x: 0, y: 0 }, scale: 1 });
    const style = HAND_STYLES[installedHandStyle(doc())] || HAND_STYLES[HAND_DEFAULT_STYLE];
    return `<svg class="hand-pose-preview" viewBox="-48 -50 96 92" width="120" height="115" role="img" aria-label="Pose preview" data-hand-editor-preview="${side}">${parts.order
      .map((part) => `<path d="${parts.paths[part]}" fill="${style.fill}" stroke="${style.line}" stroke-width="${style.width}" stroke-linejoin="round" stroke-linecap="${handPartCaps(part)}"/>`).join('')}</svg>`;
  }

  /**
   * The pose editor: numbers per digit, a preview drawn from them, Capture to
   * write the keys. Only for a hand the generator drew -- any other artwork has
   * no table to edit -- so the section is dropped otherwise.
   */
  function editorFor(side) {
    const state = doc();
    if (!isGeneratedHand(state, side)) return '';
    const editor = editorOf(side);
    const hand = state.hands[side];
    const view = EDITOR_VIEWS.find((item) => item.id === editor.view)?.view || 'front';
    const merged = handPoseTable(view, editedTable(editor));
    const digit = editor.digit;
    const sliders = (digit === 'palm' ? HAND_EDITOR_PALM_FIELDS : HAND_EDITOR_FIELDS).map((field) => {
      const value = digit === 'palm' ? merged.palm[field.id] : (merged.digits[digit][field.id] ?? 0);
      return `<label class="small">${esc(field.label)} <output data-hand-editor-readout="${side}:${field.id}">${round2(value)}</output>
        <input type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${round2(value)}" data-hand-editor-slider="${field.id}" data-hand-side="${side}" aria-label="${esc(field.label)} of the ${esc(digit)}"${field.hint ? ` title="${esc(field.hint)}"` : ''}></label>`;
    }).join('');
    const heel = digit === 'palm' ? `<label class="small"><input type="checkbox" data-hand-editor-field="heel" data-hand-side="${side}"${merged.heel ? ' checked' : ''}> Show the heel of the thumb</label>` : '';
    return `<div class="hand-editor" data-hand-editor="${side}">
      <div class="hand-fields">
        <label class="small">Pose <select data-hand-editor-field="pose" data-hand-side="${side}" aria-label="Pose to edit">
          <option value=""${editor.poseId ? '' : ' selected'}>New pose…</option>
          ${hand.poses.map((pose) => `<option value="${esc(pose.id)}"${pose.id === editor.poseId ? ' selected' : ''}>${esc(pose.name || pose.id)}</option>`).join('')}
        </select></label>
        <label class="small">Name <input type="text" data-hand-editor-field="name" data-hand-side="${side}" value="${esc(editor.name)}" placeholder="Rock on" aria-label="Pose name"></label>
      </div>
      ${poseChipRow({ attribute: 'data-hand-editor-view', group: side, poses: EDITOR_VIEWS.map((item) => ({ id: item.id, name: item.name, active: item.id === editor.view, title: item.id === 'profile' && !editor.profileTable ? 'This pose has no side drawing yet: edit one here and it is captured too' : `Edit the ${item.name.toLowerCase()}` })) })}
      <div class="hand-editor-body">
        ${previewFor(side, editor)}
        <div class="hand-editor-controls">
          ${poseChipRow({ attribute: 'data-hand-editor-digit', group: side, poses: EDITOR_DIGITS.map((item) => ({ id: item.id, name: item.name, active: item.id === digit })) })}
          <div class="hand-fields" data-hand-editor-sliders="${side}">${sliders}${heel}</div>
          <div class="hand-actions">
            ${digit !== 'palm' && digit !== 'thumb' ? `<button type="button" class="secondary" data-hand-editor-action="aim" data-hand-side="${side}">Touch the thumb</button>` : ''}
            <button type="button" class="secondary" data-hand-editor-action="reset" data-hand-side="${side}">Reset ${esc(digit)}</button>
            <button type="button" data-hand-editor-action="capture" data-hand-side="${side}">${editor.poseId ? 'Capture again' : 'Capture as pose'}</button>
            ${editor.poseId ? `<button type="button" class="secondary" data-hand-editor-action="drop" data-hand-side="${side}">Remove pose</button>` : ''}
          </div>
        </div>
      </div>
      <p class="small">A pose is numbers: fold, hook, point, lengthen or widen each digit, then Capture writes a shape key on every part it moves. ${editor.profileTable ? 'It has a side drawing of its own.' : 'Edit the side view to give it a drawing of its own in profile.'}</p>
    </div>`;
  }

  /**
   * The poses this hand can strike, as one row: what it has, and what it could
   * have. A pose with no shape and no artwork of its own is a name and nothing
   * else, and says so rather than pretending to work.
   */
  function posesFor(side) {
    const poses = handPosePresets(doc(), side);
    if (!poses.length) return '';
    const live = liveValues();
    return poseChipRow({
      attribute: 'data-hand-pose-chip', group: side,
      poses: poses.map((pose) => ({
        id: pose.id, name: pose.name, offer: !pose.added,
        active: pose.added && Object.entries(pose.values).every(([name, value]) => Math.abs(Number(live[name] || 0) - value) < 0.02),
        title: pose.added ? (pose.ready ? `Strike ${pose.name}` : `${pose.name} still needs ${pose.missing}`) : `Add ${pose.name} to this hand`
      }))
    });
  }

  /**
   * Palm, side or far side: the facing a hand made of parts turns through. A
   * live control like the pose chips, and only for a hand that has the axis.
   */
  function viewsFor(side) {
    const facing = handFacingParameter(side);
    if (!doc().params?.[facing]) return '';
    const live = Number(liveValues()[facing] || 0);
    return poseChipRow({
      attribute: 'data-hand-view-chip', group: side, label: 'View',
      poses: HAND_FACING_STOPS.map((stop) => ({ id: stop.id, name: stop.name, active: Math.abs(live - stop.value) < 0.02, title: `Turn the hand: ${stop.name.toLowerCase()}` }))
    });
  }

  function render() {
    host.dataset.handSetupReady = 'true';
    host.dataset.handSetupCount = String(HAND_SIDES.filter((side) => doc().hands?.[side]).length);
    // Nothing to rig until something is drawn, and "draw a hand somewhere else
    // and import it" is where this feature used to end for most people.
    const offer = drawHands && !handsDrawn() ? `<div class="hand-actions"><button type="button" data-hand-action="draw" data-hand-side="left">✋ Draw a pair of hands</button>
        <label class="small">Look <select data-hand-style aria-label="Hand style">${Object.values(HAND_STYLES).map((style) => `<option value="${style.id}"${style.id === drawStyle ? ' selected' : ''}>${esc(style.name)}</option>`).join('')}</select></label></div>
      <p class="small">Cartoon hands in parts — a palm, four fat digits and a cuff — rigged to the head with nine poses, a curl per finger, a grip and a Wave to try. Everything about them stays editable afterwards.</p>` : '';
    host.innerHTML = `<p class="small">Two floating hands, Rayman style: no arms, no bones. Pick artwork for a hand and it hangs off an anchor on the body, following it while keeping its own movement.</p>
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
