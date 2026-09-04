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
import { handDigitParameter, HAND_DIGIT_CONTROLS } from '../../core/sample/hand-feature.js';
import { disclosurePanel } from '../../ui/disclosure.js';
import { rememberOpen } from '../../ui/panel-render.js';
import { poseChipRow } from '../../ui/pose-chips.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const SIDE_LABEL = { left: 'Left hand', right: 'Right hand' };

/** The steps in order, so the panel can say what to do next rather than only what is wrong. */
export function handSetupSteps(hand, elements = {}) {
  if (!hand?.element) return { done: 0, next: 'Choose the artwork that draws this hand.' };
  if (elements && !elements[hand.element]) return { done: 0, next: 'Its artwork no longer exists. Choose another.' };
  if (!hand.parent) return { done: 1, next: 'Choose the body part the hand hangs from.' };
  if (hand.anchor.x === 0 && hand.anchor.y === 0) return { done: 2, next: 'Place the anchor point on the body.' };
  if (!hand.poses.length) return { done: 3, next: 'Add a pose, such as Wave — optional, but it is what makes a hand act.' };
  return { done: 4, next: 'Ready. Test it from Preview.' };
}

export function createHandSetupPanel(host, store, history, { onSelect = () => {}, artboardWidth = () => 0, measure = () => null, applyPose = () => {}, liveValues = () => ({}), drawHands = null, handsDrawn = () => false, showHandRig = () => {} } = {}) {
  if (!host) throw new Error('Missing required UI element: #hand-setup');
  // The card rebuilds on every hand edit — ticking "cartoon lag" inside Physics
  // must not close Physics.
  const sections = rememberOpen(host);
  const commands = createHandCommands(store, history);
  let notice = null;
  let openSide = 'left';
  const doc = () => store.getDocument();
  const say = (tone, text) => { notice = { tone, text }; };

  const artworkOptions = (selected) => Object.keys(doc().elements || {})
    .map((id) => `<option value="${esc(id)}"${id === selected ? ' selected' : ''}>${esc(doc().layerMetadata?.[id]?.name || id)}</option>`).join('');

  host.addEventListener('click', (event) => {
    const chip = event.target.closest?.('[data-hand-pose-chip]');
    if (chip) {
      const [side, id] = chip.dataset.handPoseChip.split(':');
      const pose = handPosePresets(doc(), side).find((item) => item.id === id);
      if (pose?.added) { applyPose(pose.values); say(pose.ready ? 'ok' : 'warn', pose.ready ? `${pose.name}.` : `${pose.name} has no shape or artwork yet, so nothing moves. Give it one below.`); }
      else { const preset = SUGGESTED_HAND_POSES.find((item) => item.id === id); if (preset && commands.addPose(side, preset)) say('ok', `${preset.name} added. Give it a shape key or its own artwork.`); }
      render();
      return;
    }
    const button = event.target.closest('button');
    if (!button) return;
    const { handAction, handSide, handPose } = button.dataset;
    if (!handAction) return;
    const side = handSide || openSide;
    if (handAction === 'draw') { if (drawHands?.()) say('ok', 'Two hands drawn and rigged, with six poses and a curl per finger ready to try.'); }
    if (handAction === 'open-hand') {
      applyPose(Object.fromEntries([
        ...HAND_DIGIT_CONTROLS.map((digit) => [handDigitParameter(side, digit.id), 0]),
        ...(doc().hands?.[side]?.poses || []).map((pose) => [pose.parameter, 0])
      ]));
    }
    if (handAction === 'open') { openSide = side; notice = null; }
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
    if (finger) applyPose({ [finger.dataset.handFinger]: Number(finger.value) });
  });

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
      </div>`;
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
    const advanced = `<label class="small">Depth<input type="range" min="-1" max="1" step="0.05" data-hand-field="depth" data-hand-side="${side}" value="${hand.depth}"></label>
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
        { id: key('poses'), level: 'basic', title: 'Poses', body: posesFor(side) },
        { id: key('fingers'), level: 'more', title: 'Fingers', open: sections.has(key('fingers')), body: fingersFor(side) },
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

  function render() {
    host.dataset.handSetupReady = 'true';
    host.dataset.handSetupCount = String(HAND_SIDES.filter((side) => doc().hands?.[side]).length);
    // Nothing to rig until something is drawn, and "draw a hand somewhere else
    // and import it" is where this feature used to end for most people.
    const offer = drawHands && !handsDrawn() ? `<div class="hand-actions"><button type="button" data-hand-action="draw" data-hand-side="left">✋ Draw a pair of hands</button></div>
      <p class="small">Four digits each, rigged to the head, with Fist, Point and Peace poses and a Wave to try. Everything about them stays editable afterwards.</p>` : '';
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
