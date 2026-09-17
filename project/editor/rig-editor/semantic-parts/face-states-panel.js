/**
 * Face states, as a panel (docs/FACE_SVG_STATES.md, docs/VISEME_SYSTEM.md).
 *
 * ```text
 *  EYES     left ⟷ right      neutral · wide · half · closed · squint · …
 *           correctives       closed ▓▓▓░  narrowed ░░░░  curve ▓░░░
 *
 *  MOUTH    expressions       Happy · Sad · Angry · …
 *           visemes           REST · MBP · FV · AE · EE · OH · OO · L
 *           together          Happy + AE at 0.65      ← the one that matters
 * ```
 *
 * It is **not** a character builder and it makes no drawings: it is a section
 * of the existing Rig ▸ Controls screen, beside Movements, and every button it
 * has writes either live preview values or one shape key.
 *
 * ## The distinction the whole panel is built around
 *
 * ```text
 *  EDIT BASE        changes the neutral drawing        (the SVG editor)
 *  EDIT CORRECTIVE  records a difference from it       (this panel)
 * ```
 *
 * Pressing *Shape it* opens the canvas's own node editor on the piece with its
 * topology locked, and what comes back is stored as a **delta** — the base
 * artwork is never rewritten (`core/face-library/face-state-commands.js`). An
 * outline posed into a different shape of outline is refused with the reason,
 * and the refusal costs no undo step. That is said in as many words in the
 * panel, because a tool that silently edits the neutral face is a tool an
 * author cannot trust.
 *
 * ## What a press does
 *
 * A state chip writes **live preview values** and authors nothing: posing the
 * mascot is what Auto Key is for, and the panel hands its values to the same
 * `applyPose` every other rig panel uses (VNX-35). Only *Shape it*, the weight
 * slider and *Forget* touch the project.
 */
import { faceStateModel, composeFaceState } from '../../core/face-library/face-state-model.js';
import { createFaceStateCommands } from '../../core/face-library/face-state-commands.js';
import { installedVisemes } from '../../core/face-library/face-state-install.js';
import { REQUIRED_VISEME_KEYS } from '../../core/face-library/face-states.js';
import { disclosurePanel } from '../../ui/disclosure.js';
import { rememberOpen, setPanelHtml } from '../../ui/panel-render.js';
import { poseChipRow } from '../../ui/pose-chips.js';
import { resolveStateParams } from '../../../runtime/runtime.js';
import { esc } from '../../ui/escape-html.js';

const percent = (value) => `${Math.round(Number(value) * 100)}%`;
const bar = (value) => {
  const filled = Math.max(0, Math.min(4, Math.round(Math.abs(Number(value)) * 4)));
  return `${'▓'.repeat(filled)}${'░'.repeat(4 - filled)}`;
};

/**
 * @param {HTMLElement} host
 * @param {object} store
 * @param {object} history
 * @param {object} deps
 * @param {(values: object) => void} deps.applyPose            live values, and Auto Key
 * @param {() => object} deps.liveValues                       what the face is showing
 * @param {(id: string) => string|null} deps.pathOf            an element's outline
 * @param {(id, path, handlers) => void} deps.beginShapePose   the canvas's node editor
 * @param {() => void} deps.cancelPose
 * @param {(text: string) => void} [deps.onStatus]
 * @param {(id: string) => void} [deps.select]
 */
export function createFaceStatesPanel(host, store, history, {
  applyPose = () => {}, liveValues = () => ({}), pathOf = () => null,
  beginShapePose = null, cancelPose = () => {}, onStatus = () => {}, select = () => {}
} = {}) {
  const commands = createFaceStateCommands(store, history);
  const sections = rememberOpen(host);
  const doc = () => store.getDocument();
  // Session state and nothing else: which eye is being worked on, and what the
  // combined preview is set to. No project stores any of it, for the same
  // reason no project stores which cages were open.
  let side = 'left';
  let combination = { expressionId: null, viseme: null, blend: 1 };
  let notice = null;
  let posing = null;

  const model = () => faceStateModel(doc(), { side, values: liveValues(), ...combination });

  const say = (tone, text) => { notice = { tone, text }; onStatus(text); };

  /* ── Posing ─────────────────────────────────────────────────────────────── */

  /**
   * Put the live face into a state, or into a combination, without authoring.
   *
   * The combination goes through `composeFaceState`, which is the mixer's own
   * arithmetic: an author checking *happy + AE at 0.65* is checking what the
   * runtime will do rather than a panel's idea of it.
   *
   * It composes from **the pose the rig rests in**, not from what is on screen.
   * A combination is an absolute face — the mixer starts from the state's own
   * values and adds the expression and the speech as deltas — so pressing the
   * same combination twice gives the same face. Reading the live values here
   * instead made every press add another helping of itself, and the mouth
   * walked open.
   */
  function poseCombination() {
    const state = doc();
    const expression = combination.expressionId
      ? (state.expressions || []).find((item) => item.id === combination.expressionId)?.controls || null
      : null;
    const base = resolveStateParams(state.params, state.states?.[state.activeState]);
    applyPose(composeFaceState(state, { base, expression, viseme: combination.viseme, blend: combination.blend }));
  }

  /* ── Capturing a corrective ─────────────────────────────────────────────── */

  /**
   * Shape one piece of artwork for one state, and keep the difference.
   *
   * The canvas is asked for a **morph pose**: node handles on one path with
   * its topology locked, which is the same bargain the head pose makes for the
   * same reason (docs/HEAD_POSE_2_5D.md). What that guarantees is that the
   * delta can be measured at all — an author who added a point would strand
   * every corrective already captured against the old count.
   */
  function shape(kind, slotId, target) {
    if (!beginShapePose) { say('warn', 'Shaping a corrective needs the canvas.'); render(); return; }
    const base = doc().elements?.[target]?.restPath || pathOf(target);
    if (!base) { say('warn', 'That piece has no outline to correct. Convert it to a path first.'); render(); return; }
    const slot = [...model()[kind === 'eye' ? 'eyes' : 'mouth'].correctives].find((item) => item.id === slotId);
    posing = { kind, slot: slotId, target };
    select(target);
    beginShapePose(target, base, {
      capture: (posed) => {
        posing = null;
        const result = commands.capture({
          kind, slot: slotId, side: slot?.sided ? side : null, target,
          restPath: base, posePath: posed, weight: 1
        });
        if (result.ok) say('success', `✓ ${slot?.name || slotId} corrective captured on ${target}.`);
        else say('warn', result.message || 'That shape could not be used.');
        render();
      },
      cancel: () => { posing = null; render(); }
    });
    render();
  }

  /* ── Events ─────────────────────────────────────────────────────────────── */

  host.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const data = button.dataset;
    if (data.faceSide) { side = data.faceSide; notice = null; render(); return; }
    if (data.faceEyeState) {
      const row = model().eyes.states.find((item) => item.id === data.faceEyeState);
      if (!row?.usable) { say('warn', `${row?.name || data.faceEyeState} needs ${row?.missing.join(', ') || 'a movement'} turned on.`); render(); return; }
      applyPose(row.values);
      if (row.missing.length) say('warn', `${row.name}: ${row.missing.join(', ')} would make it exact.`);
      else notice = null;
      render();
      return;
    }
    if (data.faceViseme) {
      const row = model().mouth.visemes.find((item) => item.id === data.faceViseme);
      if (!row?.usable) { say('warn', `${row?.name || data.faceViseme} needs ${row?.missing.join(', ') || 'a mouth'}.`); render(); return; }
      combination = { ...combination, viseme: row.id };
      poseCombination();
      render();
      return;
    }
    if (data.faceExpression !== undefined) {
      combination = { ...combination, expressionId: data.faceExpression || null };
      poseCombination();
      render();
      return;
    }
    if (data.faceShape) { const [kind, slot, target] = data.faceShape.split('|'); shape(kind, slot, target); return; }
    if (data.faceForget) {
      const [kind, slot, target] = data.faceForget.split('|');
      const row = model()[kind === 'eye' ? 'eyes' : 'mouth'].correctives.find((item) => item.id === slot);
      const result = commands.remove({ kind, slot, side: row?.sided ? side : null, target });
      if (result.ok) say('success', `${row?.name || slot} corrective forgotten. The state is back to its controls alone.`);
      else say('warn', result.message || 'Nothing to forget.');
      render();
      return;
    }
    if (data.faceCopy) {
      const to = side === 'left' ? 'right' : 'left';
      const result = commands.copy({ kind: 'eye', from: side, to, peer: peerLid, mirror: data.faceCopy === 'mirror' });
      if (result.ok) say('success', `✓ ${result.copied} corrective${result.copied === 1 ? '' : 's'} copied to the ${to} eye${data.faceCopy === 'mirror' ? ', reflected' : ''}.`);
      else say('warn', result.message || 'Nothing to copy.');
      render();
      return;
    }
    if (data.faceInstallVisemes !== undefined) {
      const result = commands.installVisemes({ keys: REQUIRED_VISEME_KEYS });
      if (result.ok) say('success', result.added.length ? `✓ ${result.added.length} speech shape${result.added.length === 1 ? '' : 's'} added. Try one beside a face.` : 'The mouth already has them.');
      else say('warn', result.message || 'These could not be added.');
      render();
      return;
    }
    if (data.faceCancelPose !== undefined) { posing = null; cancelPose(); render(); }
  });

  host.addEventListener('input', (event) => {
    const data = event.target.dataset;
    if (data.faceBlend !== undefined) {
      combination = { ...combination, blend: Number(event.target.value) };
      poseCombination();
      // Rendered rather than left alone: the readout beside the slider is the
      // number an author is reading while they drag it.
      renderBlendReadout();
      return;
    }
    if (data.faceWeight) {
      const [kind, slot, target] = data.faceWeight.split('|');
      const row = model()[kind === 'eye' ? 'eyes' : 'mouth'].correctives.find((item) => item.id === slot);
      const result = commands.setWeight({ kind, slot, side: row?.sided ? side : null, target }, Number(event.target.value));
      if (!result.ok) say('warn', result.message || 'That weight could not be set.');
      render();
    }
  });

  /**
   * The other eye's version of one lid.
   *
   * Read off the semantic part rather than from the id, so a mascot whose lids
   * are called anything at all still copies onto the right shape. The role
   * names are the registry's (`leftUpper` ⟷ `rightUpper`), which is the one
   * thing that is the same on every rig.
   */
  function peerLid(target) {
    const lids = Object.values(doc().semanticParts || {}).find((part) => part.type === 'eyelids');
    const roles = lids?.roles || {};
    const role = Object.keys(roles).find((name) => roles[name] === target);
    if (!role) return target;
    const twin = role.startsWith('left') ? role.replace(/^left/, 'right') : role.replace(/^right/, 'left');
    return roles[twin] || target;
  }

  /* ── Rendering ──────────────────────────────────────────────────────────── */

  const stateChips = (rows, attribute, group) => poseChipRow({
    poses: rows.map((row) => ({
      id: row.id, name: row.name, active: row.active, disabled: !row.usable,
      title: row.missing?.length ? `${row.description} ${row.missing.join(' and ')} would make it exact.` : row.description
    })),
    attribute, group
  });

  function correctiveRow(kind, row) {
    const targets = row.targets.filter((target) => target.path);
    if (!targets.length) return '';
    const captured = new Map(row.captured.map((item) => [item.target, item]));
    const lit = Math.abs(row.activation) > 0.005;
    return `<li class="face-corrective" data-face-corrective="${esc(row.id)}"${lit ? ' data-face-lit="true"' : ''}>
      <b>${esc(row.name)}</b> <span class="small" aria-label="How far this pose asks for it">${bar(row.activation)} ${esc(row.activation.toFixed(2))}</span>
      <small>${esc(row.hint)}</small>
      <code class="small">${esc(row.expression)}</code>
      ${targets.map((target) => {
    const key = captured.get(target.id);
    return `<div class="face-corrective-target">
        <span>${esc(target.name)}</span>
        ${key
    ? `<label class="small">Weight <input type="range" min="0" max="1" step="0.05" value="${key.weight}" data-face-weight="${kind}|${esc(row.id)}|${esc(target.id)}" aria-label="${esc(row.name)} corrective weight on ${esc(target.name)}"><output>${percent(key.weight)}</output></label>
           <button type="button" class="secondary" data-face-shape="${kind}|${esc(row.id)}|${esc(target.id)}">Reshape</button>
           <button type="button" class="danger secondary" data-face-forget="${kind}|${esc(row.id)}|${esc(target.id)}">Forget</button>`
    : `<button type="button" class="secondary" data-face-shape="${kind}|${esc(row.id)}|${esc(target.id)}">Shape it</button>`}
      </div>`;
  }).join('')}
    </li>`;
  }

  const correctiveList = (kind, rows) => {
    const body = rows.map((row) => correctiveRow(kind, row)).filter(Boolean).join('');
    return body ? `<p class="small">A corrective records the <b>difference</b> from the drawing, never the drawing itself. Shaping one here cannot change the neutral face — that is the SVG editor's job.</p><ul class="face-correctives">${body}</ul>` : '';
  };

  function renderBlendReadout() {
    const output = host.querySelector('[data-face-blend-readout]');
    if (output) output.textContent = percent(combination.blend);
  }

  function render() {
    const state = doc();
    if (!state.svgMarkup) { host.innerHTML = ''; host.hidden = true; return; }
    const face = model();
    host.hidden = false;
    host.dataset.faceStatesReady = 'true';
    host.dataset.faceStatesCaptured = String(face.captured);
    host.dataset.faceStatesSide = side;
    const missingVisemes = REQUIRED_VISEME_KEYS.filter((key) => !installedVisemes(state).includes(key));

    const eyes = face.eyes.ready
      ? `${face.eyes.sided ? `<div class="face-side-switch" role="group" aria-label="Which eye">
          ${['left', 'right'].map((name) => `<button type="button" class="chip${side === name ? ' chip-active' : ''}" data-face-side="${name}" aria-pressed="${side === name}">${name === 'left' ? 'Left eye' : 'Right eye'}</button>`).join('')}
        </div><p class="small">A state is written as this eye's own offset, so the other eye stays where it is — which is what a wink is (docs/FACE_CONTROL_RIG.md).</p>`
    : '<p class="small">Turn on <b>One side at a time</b> for Eyes · Open / close to pose the two eyes apart.</p>'}
      ${stateChips(face.eyes.states, 'data-face-eye-state', '')}
      <p class="small">Pressing one poses the face. The gaze is untouched: look somewhere first and the state keeps the look.</p>
      ${disclosurePanel([{
    id: 'face-eye-correctives', title: 'Correctives', level: 'more',
    hint: `${face.eyes.correctives.filter((row) => row.captured.length).length} captured`,
    open: sections.has('face-eye-correctives'),
    body: `${correctiveList('eye', face.eyes.correctives)}
          <div class="inline"><button type="button" class="secondary" data-face-copy="copy">Copy to the ${side === 'left' ? 'right' : 'left'} eye</button><button type="button" class="secondary" data-face-copy="mirror">Copy, reflected</button></div>
          <p class="small">Copy when the two lids are drawn as mirror images of each other; copy reflected when one was drawn from the other slid across the face.</p>`
  }])}`
      : '<p class="small">Assign the eyelids in Face parts to give the eyes their states.</p>';

    const mouth = face.mouth.ready
      ? `${missingVisemes.length ? `<p class="face-pick-notice" data-tone="info">This mouth has ${missingVisemes.length === REQUIRED_VISEME_KEYS.length ? 'no speech shapes' : `${missingVisemes.length} speech shape${missingVisemes.length === 1 ? '' : 's'} missing`}. <button type="button" class="secondary" data-face-install-visemes>Add them</button></p>` : ''}
      ${stateChips(face.mouth.visemes, 'data-face-viseme', '')}
      <p class="small">A speech shape is a face like any other, mixed on top of the one the mascot is wearing — so a smile survives a sentence.</p>
      ${disclosurePanel([{
    id: 'face-mouth-together', title: 'Expression and speech together', level: 'basic',
    body: `<div class="face-combination">
            <label>Face <select data-face-expression><option value="">none</option>${face.mouth.expressions.map((item) => `<option value="${esc(item.id)}"${item.id === combination.expressionId ? ' selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>
            <label>Speech <select data-face-viseme-select><option value="">none</option>${face.mouth.visemes.filter((row) => row.usable).map((row) => `<option value="${esc(row.id)}"${row.id === combination.viseme ? ' selected' : ''}>${esc(row.name)}</option>`).join('')}</select></label>
            <label>How far <input type="range" min="0" max="1" step="0.05" value="${combination.blend}" data-face-blend aria-label="How far into the speech shape"><output data-face-blend-readout>${percent(combination.blend)}</output></label>
          </div>
          <p class="small">${combination.expressionId || combination.viseme ? `Showing ${esc(face.mouth.combination.expression || 'the face as posed')}${combination.viseme ? ` saying ${esc(combination.viseme)} at ${percent(combination.blend)}` : ''}.` : 'Pick a face and a speech shape to check the two together.'}</p>`
  }, {
    id: 'face-mouth-correctives', title: 'Correctives', level: 'more',
    hint: `${face.mouth.correctives.filter((row) => row.captured.length).length} captured`,
    open: sections.has('face-mouth-correctives'),
    body: correctiveList('mouth', face.mouth.correctives)
  }])}`
      : '<p class="small">Assign the mouth in Face parts to give it speech shapes.</p>';

    setPanelHtml(host, `<h3 id="face-states-heading" class="visually-hidden">Face states</h3>
      <div role="status" aria-live="polite">${notice ? `<p class="face-pick-notice" data-tone="${notice.tone}">${esc(notice.text)}</p>` : ''}${posing ? `<p class="face-pick-notice" data-tone="info">Shaping the ${esc(posing.slot)} corrective on ${esc(posing.target)}. <button type="button" class="secondary" data-face-cancel-pose>Cancel</button></p>` : ''}</div>
      <section aria-labelledby="face-states-eyes"><h4 id="face-states-eyes">Eyes</h4>${eyes}</section>
      <section aria-labelledby="face-states-mouth"><h4 id="face-states-mouth">Mouth</h4>${mouth}</section>`);
  }

  host.addEventListener('change', (event) => {
    const data = event.target.dataset;
    if (data.faceExpression !== undefined) {
      combination = { ...combination, expressionId: event.target.value || null };
      poseCombination();
      render();
      return;
    }
    if (data.faceVisemeSelect !== undefined) {
      combination = { ...combination, viseme: event.target.value || null };
      poseCombination();
      render();
    }
  });

  return {
    render,
    /** What the panel is showing, for the e2e hooks and the tests. */
    snapshot: () => ({ side, combination: { ...combination }, ...structuredClone(model()) }),
    /** Session state, so a screen change does not leave a pose session open. */
    cancelTransient() { if (posing) { posing = null; cancelPose(); } }
  };
}
