import { bandSubject, byTier, contextualMovements, deriveMovementChecklist, movementSubject } from './face-movements.js';
import { createSemanticRigCommands } from './semantic-rig-commands.js';
import { selectionSubject } from '../../core/selectors/selection-subject.js';
import { activePartPose, partPoses } from '../../core/puppet/part-poses.js';
import { poseChipRow } from '../../ui/pose-chips.js';
import { esc } from '../../ui/escape-html.js';

const ICONS = { calibrated: '✓', on: '✓', off: '○', incomplete: '●', unassigned: '○' };

/**
 * Movements (left panel, Rig ▸ Controls).
 *
 * Toggling a movement is one semantic command (enable/disable); opening one
 * only changes EditorSession selection so the single Inspector shows it.
 *
 * ## What is on screen, and why it is not everything (UX-50 PR 2)
 *
 * This panel used to render all twenty-six movements, in five bands, on every
 * render, whatever the author had selected. That is an inventory rather than a
 * tool: *Tongue curl* sat at the same size as *Open / close*, and an author who
 * had just clicked a mouth still had to find the Mouth band by eye.
 *
 * So the selection decides. With a part of the face in hand the panel shows
 * **that band** — the quick movements open, the rest folded — and with nothing
 * in hand it shows the five **families** and how ready each one is, which is a
 * way in rather than a wall. `Show all controls` puts the inventory back for
 * the session, because progressive disclosure without an escape hatch is how a
 * feature becomes unreachable (§34 of the brief).
 *
 * The subject comes from `core/selectors/selection-subject.js`, which is the
 * one derivation every contextual panel reads. Nothing here keeps a second
 * idea of what is selected.
 */
export function createFaceMovementsPanel(host, store, history, editorContext, { openMovement = () => {}, applyPose = () => {}, liveValues = () => ({}) } = {}) {
  const commands = createSemanticRigCommands(store, history);
  let notice = null;
  // Session-only, and deliberately not in the document: which controls somebody
  // is looking at is not a property of their mascot (§3, Règle D).
  let showAll = false;
  // Which parts have their folded movements open, by group name. Also session.
  const openedMore = new Set();
  const doc = () => store.getDocument();
  const itemFor = (id) => deriveMovementChecklist(doc()).items.find((item) => item.id === id) || null;
  /** What the author has in hand, as a band of the face. */
  const subject = () => selectionSubject(doc(), store.getSession());

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
    if (!item?.partIds?.length) return;
    // Every part the row covers, in one undo step: a movement two parts share
    // -- the eyes and their lids -- goes on and off as the one movement it is.
    const entries = item.partIds.map((partId) => ({ partId, control: id }));
    try {
      if (event.target.checked) commands.enableControls(entries);
      else commands.disableControls(entries);
      notice = null;
      if (!event.target.checked && editorContext.get().activeControl === id) editorContext.update({ activeControl: null });
    } catch (error) { notice = { tone: 'warn', text: `${item.label}: ${error.message}` }; }
    render();
  });
  host.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !host.contains(button)) return;
    const opening = button.dataset.movementOpen || button.dataset.movementAdvanced;
    if (opening) {
      const item = itemFor(opening);
      if (item?.partId) openMovement(item.partId, item.id);
      return;
    }
    if (button.dataset.movementShowAll !== undefined) {
      showAll = button.dataset.movementShowAll === 'on';
      render();
      return;
    }
    if (button.dataset.movementFamily) {
      // Pressing a family is a *selection*, not a filter: the canvas, the
      // Inspector and this panel then agree about what is being worked on,
      // which is the whole point of one selection (§4 of the brief).
      //
      // So it moves **both** halves. Writing only the active part would leave
      // `selectedId` on the head somebody had clicked, and the piece in hand
      // outranks the active part — the panel would have answered "Head" to a
      // press on "Eyes".
      const band = button.dataset.movementFamily;
      const first = deriveMovementChecklist(doc()).items.find((item) => item.band === band && item.partId);
      if (first) {
        const part = doc().semanticParts?.[first.partId];
        const element = Object.values(part?.roles || {}).find(Boolean) || null;
        editorContext.update({ activeSemanticPartId: first.partId, activeControl: null, ...(element ? { selectedId: element } : {}) });
        // Asking for one part of the face is asking to stop looking at all of
        // them; leaving the inventory up would ignore the press.
        showAll = false;
      }
      render();
      return;
    }
    if (button.dataset.movementMore) {
      const group = button.dataset.movementMore;
      if (openedMore.has(group)) openedMore.delete(group); else openedMore.add(group);
      render();
      return;
    }
    if (button.dataset.movementEnableAll !== undefined) {
      // Scoped to what is on screen: an author looking at the Mouth who presses
      // "turn these on" has not asked for the ears.
      const shown = new Set(shownItems().map((item) => item.id));
      const entries = deriveMovementChecklist(doc()).items.filter((item) => item.status === 'off' && shown.has(item.id))
        .flatMap((item) => item.partIds.map((partId) => ({ partId, control: item.id })));
      if (!entries.length) return;
      try { commands.enableControls(entries); notice = { tone: 'success', text: `✓ ${entries.length} movement${entries.length === 1 ? '' : 's'} turned on. Open one to set it up and try it.` }; }
      catch (error) { notice = { tone: 'warn', text: error.message }; }
      render();
    }
  });

  // The row says where the movement is in its own setup, in the words the
  // Movement Inspector uses: positions set, never ranges or amplitudes.
  function detail(item) {
    // The words for a part live in `face-movements.js` and nowhere else: the
    // copy that used to be here knew five parts of ten, so Nose, Jaw, Tongue,
    // Hair and Ears all read "Assign the artwork first" without saying which.
    if (item.status === 'unassigned' || item.status === 'incomplete') return `Assign ${movementSubject(item.part)} first`;
    if (item.status === 'off') return 'Off';
    if (item.status === 'calibrated') return 'On · ready';
    if (item.method === 'morph') return item.moving ? 'On · ready' : 'On · shape not set yet';
    if (item.captured) return `On · ${item.captured} of ${item.total} positions set`;
    // It moves already: the positions only tune how far. Saying "not set up"
    // about a movement the author can see working read as a failed step.
    if (item.movingBy === 'headPose') return 'On · ready · from the head pose';
    return item.moving ? 'On · ready · default range' : 'On · not set up yet';
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
    const view = contextualMovements(checklist, { band: subject()?.band || null, showAll });
    host.dataset.faceMovementsScope = view.scope;
    host.dataset.faceMovementsBand = view.band || '';
    host.dataset.faceMovementsShown = String(view.shown);
    host.dataset.faceMovementsHidden = String(view.hidden);
    // Filed under what they make the face do, and inside that under the part
    // that carries them -- the pose chips and the live sliders are per part
    // and always were (UIR-08).
    const rows = (group, items) => items.map((item) => {
      const available = item.status !== 'unassigned' && item.status !== 'incomplete';
      return `<li class="movement-row${item.id === active ? ' active' : ''}" data-movement="${item.id}" data-movement-status="${item.status}" data-movement-tier="${esc(item.tier || 'more')}"><input type="checkbox" data-movement-toggle="${item.id}" aria-label="Enable ${esc(item.label)} (${esc(group)})" ${item.enabled ? 'checked' : ''} ${available ? '' : 'disabled'}><button type="button" class="movement-label" data-movement-open="${item.id}" ${available ? '' : 'disabled'}><span>${esc(item.label)}</span><small>${esc(detail(item))}</small></button></li>`;
    }).join('');
    /**
     * One part's rows: the quick ones, then the rest behind a press.
     *
     * The fold carries its own count, so an author can see there is more
     * without opening it — and can decide not to, which is the difference
     * between folding and hiding.
     */
    const groupRows = (group, items) => {
      // `Show all controls` means all of them. Leaving eight movements folded
      // behind a second press would make the escape hatch a smaller cage:
      // whatever the panel is holding back, that button has to be the end of
      // it (§34 of the brief).
      if (view.scope === 'all') return `<ul class="movement-list">${rows(group, items)}</ul>`;
      const { quick, more } = byTier(items);
      // A group whose movements are *all* folded would open on nothing, so it
      // shows them: the tier is a ranking within a part, and a part with no
      // headline movement still has to be workable.
      const front = quick.length ? quick : more, rest = quick.length ? more : [];
      const open = openedMore.has(group);
      return `<ul class="movement-list">${rows(group, front)}</ul>${rest.length ? `<button type="button" class="movement-more" data-movement-more="${esc(group)}" aria-expanded="${open}">${open ? '▾ Fewer' : `▸ More (${rest.length})`}</button>${open ? `<ul class="movement-list" data-movement-more-list="${esc(group)}">${rows(group, rest)}</ul>` : ''}` : ''}`;
    };
    const groups = [...view.bands].map(([band, parts]) => `<li class="movement-band" data-movement-band="${esc(band)}"><b class="movement-band-name">${esc(band)}</b>${[...parts].map(([group, items]) => `<div class="movement-group" data-movement-group="${esc(group)}">${parts.size > 1 || group !== band ? `<small class="movement-group-name">${esc(group)}</small>` : ''}${posesFor(items, live)}${groupRows(group, items)}${view.scope === 'band' ? advancedFor(items) : ''}</div>`).join('')}</li>`).join('');
    const offCount = itemsIn(view).filter((item) => item.status === 'off').length;
    host.innerHTML = `<h3 id="face-movements-heading" class="visually-hidden">Movements</h3><div role="status" aria-live="polite">${notice ? `<p class="face-pick-notice" data-tone="${notice.tone}">${esc(notice.text)}</p>` : ''}</div>${intro(checklist, view)}${view.bands.size ? `<ul class="movement-groups" aria-labelledby="face-movements-heading">${groups}</ul>` : ''}${offCount ? `<button type="button" class="face-next secondary" data-movement-enable-all>Turn on ${offCount === 1 ? 'the remaining movement' : `all ${offCount} available movement${offCount === 1 ? '' : 's'}${view.scope === 'band' ? ` for the ${view.band.toLowerCase()}` : ''}`}</button>` : ''}${scopeSwitch(view)}`;
    if (focused) host.querySelector(`[data-movement-toggle="${CSS.escape(focused)}"],[data-movement-open="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  }

  /**
   * Every movement one view is showing — what a scoped action acts on.
   *
   * Takes the view rather than deriving its own: `deriveMovementChecklist`
   * walks every part of the rig, and this runs inside a render that has one to
   * hand already (§31 of the brief).
   */
  const itemsIn = (view) => [...view.bands.values()].flatMap((parts) => [...parts.values()].flat());

  /** The same, for a click handler, which has no view to hand. */
  function shownItems() {
    return itemsIn(contextualMovements(deriveMovementChecklist(doc()), { band: subject()?.band || null, showAll }));
  }

  /**
   * The line above the rows, which has one of four things to say — and says
   * only one, because a panel that explains itself three times has nothing
   * left to show.
   */
  function intro(checklist, view) {
    if (!checklist.available) return '<p class="small">Assign face parts above to unlock their movements.</p>';
    if (view.scope === 'band') {
      return `<p class="small" data-movement-scope-note>Showing <b>${esc(bandSubject(view.band))}</b>, because that is what you have selected. Drag it on the mascot to pose it; the rows below are for setting how far it goes.</p>`;
    }
    if (view.scope === 'families') {
      // The empty state §20 asks for: what to do next, in the space the rows
      // are not using, rather than a guide that lives there permanently.
      return checklist.enabled
        ? '<p class="small" data-movement-empty>Click a part of the mascot, or pick one below, to set up how it moves. Drag the face itself to pose it.</p>'
        : '<p class="small" data-movement-empty>No movements yet. Pick a part of the face below, turn a movement on, then drag that part of the mascot to try it.</p>';
    }
    if (!checklist.enabled) return '<p class="small">Turn a movement on, then drag that part of the mascot to try it.</p>';
    return '<p class="small" data-movement-puppet-hint>Drag the mascot itself to try these: the handles on the face move them.</p>';
  }

  /**
   * The families, when nothing is selected, and the way back to them.
   *
   * `Show all controls` is the escape hatch progressive disclosure owes the
   * author: it names how many rows it would add rather than offering a vague
   * "more", so pressing it is an informed choice.
   */
  function scopeSwitch(view) {
    const family = (item, compact) => `<li><button type="button" class="movement-family${compact ? ' chip' : ''}${item.band === view.band ? ' chip-active' : ''}" data-movement-family="${esc(item.band)}" aria-pressed="${item.band === view.band}" ${item.available ? '' : 'disabled'}><b>${esc(item.band)}</b><small>${item.available ? `${item.enabled} of ${item.available} on` : 'Not assigned yet'}</small></button></li>`;
    // Narrowed: the other families stay one press away, as a strip. Without
    // them the only way to another part of the face would be to put the whole
    // inventory back, which is a filter that punishes you for using it.
    if (view.scope === 'band') {
      return `<div class="movement-families" data-movement-families="compact"><small class="movement-families-name">Another part of the face</small><ul>${view.families.map((item) => family(item, true)).join('')}</ul></div>
        <button type="button" class="movement-scope secondary" data-movement-show-all="on">Show all controls${view.hidden ? ` (${view.hidden} more)` : ''}</button>`;
    }
    // `Show all controls` from the families too: the inventory is never more
    // than one press away, whichever state the panel is in.
    const toggle = view.scope === 'all'
      ? '<button type="button" class="movement-scope secondary" data-movement-show-all="off">Show only what I select</button>'
      : `<button type="button" class="movement-scope secondary" data-movement-show-all="on">Show all controls${view.hidden ? ` (${view.hidden})` : ''}</button>`;
    return `<div class="movement-families" data-movement-families="full"><small class="movement-families-name">${view.scope === 'all' ? 'Or pick a part of the face to work on' : 'Which part of the face?'}</small><ul>${view.families.map((item) => family(item, false)).join('')}</ul></div>${toggle}`;
  }

  /**
   * Where the low-level settings are — named, not copied.
   *
   * Method, driver, left/right split and calibration all live in the Movement
   * Inspector already, and §5 is explicit that the right-hand panel must not
   * become a copy of the left. So this is a pointer to them, folded, and the
   * Inspector stays the one place they are edited.
   *
   * Only while narrowed to a band. Eleven Advanced folds down the side of the
   * whole inventory would be exactly the noise this slice is removing -- and
   * an author who has pressed *Show all controls* is not asking for more.
   */
  function advancedFor(items) {
    const first = items.find((item) => item.status !== 'unassigned' && item.status !== 'incomplete' && item.partId);
    if (!first) return '';
    // Its own attribute, not `data-movement-open`: that one is the row's, and
    // two buttons answering to one selector is a selector that means nothing.
    return `<details class="movement-advanced"><summary>Advanced</summary><p class="small">How this movement is driven, whether the two sides can differ, and its calibration.</p><button type="button" class="secondary" data-movement-advanced="${esc(first.id)}">Open ${esc(first.label.toLowerCase())} in the Inspector</button></details>`;
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

  return {
    render,
    snapshot() {
      const checklist = deriveMovementChecklist(doc());
      const { groups, bands, ...rest } = checklist;
      const view = contextualMovements(checklist, { band: subject()?.band || null, showAll });
      return structuredClone({
        ...rest,
        bands: [...checklist.bands.keys()],
        // What is actually on screen, which is the thing a contextual panel has
        // to be testable about (UX-50 PR 2).
        scope: view.scope, band: view.band, shown: view.shown, hidden: view.hidden, showAll,
        families: view.families
      });
    }
  };
}
