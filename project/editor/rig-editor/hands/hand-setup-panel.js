/**
 * Hand Setup panel (docs/HAND_RIGGING.md).
 *
 * ```text
 * Hands
 *  ├─ Left Hand: Artwork · Anchor · Rest · Reach · Poses
 *  └─ Right Hand: …
 * ```
 *
 * The panel owns no hand data: it reads the `hands` block and writes through
 * atomic commands, so undo and redo work without it participating.
 */
import { createHandCommands } from '../../core/hands/hand-commands.js';
import { SUGGESTED_HAND_POSES, handReachEllipse, HAND_SIDES } from '../../core/hands/hand-model.js';

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

export function createHandSetupPanel(host, store, history, { onSelect = () => {}, artboardWidth = () => 0, measure = () => null } = {}) {
  if (!host) throw new Error('Missing required UI element: #hand-setup');
  const commands = createHandCommands(store, history);
  let notice = null;
  let openSide = 'left';
  const doc = () => store.getDocument();
  const say = (tone, text) => { notice = { tone, text }; };

  const artworkOptions = (selected) => Object.keys(doc().elements || {})
    .map((id) => `<option value="${esc(id)}"${id === selected ? ' selected' : ''}>${esc(doc().layerMetadata?.[id]?.name || id)}</option>`).join('');

  host.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const { handAction, handSide, handPose } = button.dataset;
    if (!handAction) return;
    const side = handSide || openSide;
    if (handAction === 'open') { openSide = side; notice = null; }
    if (handAction === 'remove') { commands.remove(side); say('ok', `${SIDE_LABEL[side]} removed.`); }
    if (handAction === 'select') onSelect(doc().hands?.[side]?.element || null);
    if (handAction === 'add-pose') {
      const preset = SUGGESTED_HAND_POSES.find((item) => item.id === handPose);
      if (preset && commands.addPose(side, preset)) say('ok', `${preset.name} added. Give it a shape key or its own artwork next.`);
    }
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
    const used = new Set(hand.poses.map((pose) => pose.id));
    return `<section class="hand-card" data-hand-card="${side}" data-hand-status="${steps.done === 4 ? 'ready' : 'setup'}" data-hand-step="${steps.done}">
      <h4><button type="button" data-hand-action="open" data-hand-side="${side}" aria-expanded="${open}">${SIDE_LABEL[side]}</button></h4>
      <p class="small" data-hand-next>${esc(steps.next)}</p>
      ${open ? `
      <label class="small">Artwork
        <select data-hand-field="artwork" data-hand-side="${side}">${artworkOptions(hand.element)}</select>
      </label>
      <label class="small">Anchored to
        <select data-hand-field="parent" data-hand-side="${side}"><option value="">Nothing (fixed)</option>${artworkOptions(hand.parent || '')}</select>
      </label>
      <div class="hand-fields">
        <label class="small">Anchor X<input type="number" step="1" data-hand-field="anchorX" data-hand-side="${side}" value="${hand.anchor.x}"></label>
        <label class="small">Anchor Y<input type="number" step="1" data-hand-field="anchorY" data-hand-side="${side}" value="${hand.anchor.y}"></label>
        <label class="small">Rest X<input type="number" step="1" data-hand-field="restX" data-hand-side="${side}" value="${hand.restOffset.x}"></label>
        <label class="small">Rest Y<input type="number" step="1" data-hand-field="restY" data-hand-side="${side}" value="${hand.restOffset.y}"></label>
        <label class="small">Reach across<input type="number" step="1" min="1" data-hand-field="reachX" data-hand-side="${side}" value="${hand.reach.x}"></label>
        <label class="small">Reach up<input type="number" step="1" min="1" data-hand-field="reachY" data-hand-side="${side}" value="${hand.reach.y}"></label>
        <label class="small">Turn range<input type="number" step="1" data-hand-field="reachRotation" data-hand-side="${side}" value="${hand.reach.rotation}"></label>
        <label class="small">Depth<input type="range" min="-1" max="1" step="0.05" data-hand-field="depth" data-hand-side="${side}" value="${hand.depth}"></label>
        <label class="small">Overshoot<input type="range" min="0" max="1" step="0.05" data-hand-field="softness" data-hand-side="${side}" value="${hand.softness}"></label>
      </div>
      <p class="small" data-hand-reach>${ellipse ? `Reach: ${round(ellipse.rx)} × ${round(ellipse.ry)} around (${round(ellipse.cx)}, ${round(ellipse.cy)})` : ''}</p>
      <label class="small"><input type="checkbox" data-hand-field="inertia" data-hand-side="${side}"${hand.inertia.enabled ? ' checked' : ''}> A little cartoon lag</label>
      <h5 class="small">Poses</h5>
      <ul class="hand-poses">${hand.poses.map((pose) => `<li data-hand-pose="${esc(pose.id)}">
        <span>${esc(pose.name)}</span>
        <label class="small">Shape<select data-hand-field="poseShape" data-hand-side="${side}" data-hand-pose="${esc(pose.id)}">${shapeOptions(pose.shapeKey)}</select></label>
        <label class="small">Artwork<select data-hand-field="poseVariant" data-hand-side="${side}" data-hand-pose="${esc(pose.id)}"><option value="">—</option>${artworkOptions(pose.variant || '')}</select></label>
        <button type="button" class="secondary" data-hand-action="remove-pose" data-hand-side="${side}" data-hand-pose="${esc(pose.id)}" aria-label="Remove ${esc(pose.name)}">✕</button>
      </li>`).join('')}</ul>
      <div class="hand-pose-add">${SUGGESTED_HAND_POSES.filter((pose) => !used.has(pose.id))
        .map((pose) => `<button type="button" class="secondary" data-hand-action="add-pose" data-hand-side="${side}" data-hand-pose="${pose.id}">+ ${esc(pose.name)}</button>`).join('')}</div>
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
    host.innerHTML = `<p class="small">Two floating hands, Rayman style: no arms, no bones. Pick artwork for a hand and it hangs off an anchor on the body, following it while keeping its own movement.</p>
      ${HAND_SIDES.map(renderHand).join('')}
      ${notice ? `<p class="workspace-hint" data-tone="${notice.tone}" role="status">${esc(notice.text)}</p>` : ''}`;
  }

  return { render, getOpenSide: () => openSide, openHand(side) { openSide = side; render(); } };
}

function round(value) { return Math.round((Number(value) || 0) * 100) / 100; }
