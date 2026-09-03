import { deriveMovementChecklist } from './face-movements.js';
import { createSemanticRigCommands } from './semantic-rig-commands.js';
import { activePartPose, partPoses } from '../../core/puppet/part-poses.js';
import { poseChipRow } from '../../ui/pose-chips.js';

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const ICONS = { calibrated: '✓', on: '✓', off: '○', incomplete: '●', unassigned: '○' };
const SUBJECT = { head: 'the head', eyes: 'both eyes', gaze: 'both pupils', eyebrows: 'both eyebrows', mouth: 'the mouth' };

/**
 * Movements collection (left panel, under the Face parts checklist). Toggling
 * a movement is one semantic command (enable/disable); opening a movement
 * only changes EditorSession selection so the single Inspector shows it.
 */
export function createFaceMovementsPanel(host, store, history, editorContext, { openMovement = () => {}, applyPose = () => {}, liveValues = () => ({}) } = {}) {
  const commands = createSemanticRigCommands(store, history);
  let notice = null;
  const doc = () => store.getDocument();
  const itemFor = (id) => deriveMovementChecklist(doc()).items.find((item) => item.id === id) || null;

  host.addEventListener('click', (event) => {
    const chip = event.target.closest?.('[data-pose-chip]');
    if (!chip) return;
    const [part, id] = chip.dataset.poseChip.split(':');
    const pose = partPoses(doc(), part).find((item) => item.id === id);
    if (!pose?.usable) return;
    event.stopPropagation();
    applyPose(pose.controls);
    render();
  }, true);

  host.addEventListener('change', (event) => {
    const id = event.target.dataset.movementToggle;
    if (!id) return;
    const item = itemFor(id);
    if (!item?.partId) return;
    try {
      if (event.target.checked) commands.enableControl(item.partId, id);
      else commands.disableControl(item.partId, id);
      notice = null;
      if (!event.target.checked && editorContext.get().activeControl === id) editorContext.update({ activeControl: null });
    } catch (error) { notice = { tone: 'warn', text: `${item.label}: ${error.message}` }; }
    render();
  });
  host.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !host.contains(button)) return;
    if (button.dataset.movementOpen) {
      const item = itemFor(button.dataset.movementOpen);
      if (item?.partId) openMovement(item.partId, item.id);
      return;
    }
    if (button.dataset.movementEnableAll !== undefined) {
      const entries = deriveMovementChecklist(doc()).items.filter((item) => item.status === 'off').map((item) => ({ partId: item.partId, control: item.id }));
      if (!entries.length) return;
      try { commands.enableControls(entries); notice = { tone: 'success', text: `✓ ${entries.length} movement${entries.length === 1 ? '' : 's'} turned on with default ranges. Open one to test or calibrate it.` }; }
      catch (error) { notice = { tone: 'warn', text: error.message }; }
      render();
    }
  });

  function detail(item) {
    if (item.status === 'unassigned') return `Assign ${SUBJECT[item.part] || 'the artwork'} first`;
    if (item.status === 'incomplete') return `Assign ${SUBJECT[item.part] || 'all artwork'} first`;
    if (item.status === 'off') return 'Off';
    if (item.status === 'calibrated') return `On · calibrated (${item.captured} / ${item.total} poses)`;
    return item.method === 'morph' ? 'On · shape not captured yet' : 'On · default range';
  }

  function render() {
    const state = doc();
    if (!state.svgMarkup) { host.innerHTML = ''; host.hidden = true; return; }
    const checklist = deriveMovementChecklist(state), active = editorContext.get().activeControl;
    const focused = host.contains(document.activeElement) ? document.activeElement.dataset.movementToggle || document.activeElement.dataset.movementOpen || null : null;
    host.hidden = false;
    host.dataset.faceMovementsReady = 'true';
    host.dataset.faceMovementsEnabled = String(checklist.enabled);
    host.dataset.faceMovementsAvailable = String(checklist.available);
    const live = liveValues();
    const groups = [...checklist.groups].map(([group, items]) => `<li class="movement-group"><b>${esc(group)}</b>${posesFor(items, live)}<ul class="movement-list">${items.map((item) => {
      const available = item.status !== 'unassigned' && item.status !== 'incomplete';
      return `<li class="movement-row${item.id === active ? ' active' : ''}" data-movement="${item.id}" data-movement-status="${item.status}"><input type="checkbox" data-movement-toggle="${item.id}" aria-label="Enable ${esc(item.label)} (${esc(group)})" ${item.enabled ? 'checked' : ''} ${available ? '' : 'disabled'}><button type="button" class="movement-label" data-movement-open="${item.id}" ${available ? '' : 'disabled'}><span>${esc(item.label)}</span><small>${esc(detail(item))}</small></button></li>`;
    }).join('')}</ul></li>`).join('');
    const offCount = checklist.items.filter((item) => item.status === 'off').length;
    host.innerHTML = `<h3 id="face-movements-heading" class="visually-hidden">Movements</h3><div role="status" aria-live="polite">${notice ? `<p class="face-pick-notice" data-tone="${notice.tone}">${esc(notice.text)}</p>` : ''}</div>${checklist.available ? (checklist.enabled ? '<p class="small" data-movement-puppet-hint>Drag the mascot itself to try these: the handles on the face move them.</p>' : '') : '<p class="small">Assign face parts above to unlock their movements.</p>'}<ul class="movement-groups" aria-labelledby="face-movements-heading">${groups}</ul>${offCount ? `<button type="button" class="face-next secondary" data-movement-enable-all>Turn on ${offCount === 1 ? 'the remaining movement' : `all ${offCount} available movements`}</button>` : ''}`;
    if (focused) host.querySelector(`[data-movement-toggle="${CSS.escape(focused)}"],[data-movement-open="${CSS.escape(focused)}"]`)?.focus();
  }

  /**
   * The poses this group can strike, as chips. A movement is a slider from one
   * end to the other; these are the places on it worth having a name.
   */
  function posesFor(items, live) {
    const part = items[0]?.part;
    const poses = part ? partPoses(doc(), part).filter((pose) => pose.usable) : [];
    if (!poses.length) return '';
    const current = activePartPose(poses, live);
    return poseChipRow({
      poses: poses.map((pose) => ({
        id: pose.id, name: pose.name, active: pose.id === current,
        title: pose.missing.length ? `Sets what this project has. ${pose.missing.join(' and ')} would need turning on.` : `Pose the ${part}`
      })),
      group: part
    });
  }

  return { render, snapshot() { const { groups, ...rest } = deriveMovementChecklist(doc()); return structuredClone(rest); } };
}
