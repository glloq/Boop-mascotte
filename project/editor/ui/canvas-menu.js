import { LEVEL_RANK } from './piece-actions.js';
import { esc } from './escape-html.js';

/** The deepest piece of artwork under a pointer, or null for the background. */
export function artworkIdAt(target, elements = {}, stopAt = null) {
  for (let node = target; node && node !== stopAt; node = node.parentNode) {
    const id = node.getAttribute?.('id');
    if (id && elements[id]) return id;
  }
  return null;
}

function findLayer(items, id) {
  for (const item of items || []) {
    if (item.id === id) return item;
    const nested = findLayer(item.children, id);
    if (nested) return nested;
  }
  return null;
}

/**
 * Edit one piece of the mascot, where it is drawn.
 *
 * "Il va falloir qu'on ajoute la possibilité d'éditer plus proprement chaque
 * sous-partie de la mascotte (clic droit → éditer ?)". Right-clicking a shape
 * selects it and opens this over it: its name, what face part owns it, and the
 * things one does to a piece of artwork.
 *
 * **Which** things is no longer decided here.** The menu used to carry its own
 * list of fourteen buttons, five of which named a rigging concept (*Edit
 * points*, *Add a pin here*, *Convert to a path*, *Stop cutting it*, *Assign to
 * a face part*) and all fourteen of which appeared on both screens that offered
 * the menu at all. So a beginner met "Convert to a path — for points, pins and
 * shape keys" above Delete, and the screen built *for* beginners had no menu.
 * The catalogue is `ui/piece-actions.js` now, the caller says how deep to go,
 * and the five rigging entries fold into a disclosure at the bottom.
 *
 * It is a dialog rather than a `menu`, because renaming is a text field and a
 * menu with an input in it is neither one thing nor the other.
 */
export function createCanvasMenu(host, {
  getState = () => ({}), getPart = () => null, getClip = () => null, select = () => {}, onAction = () => {}, onClose = () => {},
  /** The actions this piece offers, from `pieceActionsFor`. */
  getActions = () => [],
  // How deep this surface's menu reads before it folds (`ui/piece-actions.js`).
  depth = () => 'advanced'
} = {}) {
  let openId = null;
  const node = document.createElement('div');
  node.className = 'canvas-menu';
  node.dataset.canvasMenu = '';
  node.setAttribute('role', 'dialog');
  node.setAttribute('aria-modal', 'false');
  node.hidden = true;
  host.append(node);

  const state = () => getState() || {};
  const layerOf = (id) => findLayer(state().layers, id);

  node.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-canvas-menu-action]');
    if (!button || !openId) return;
    const action = button.dataset.canvasMenuAction;
    const id = openId;
    if (action !== 'rename') close();
    onAction(action, id, button.dataset.value);
  });
  node.addEventListener('change', (event) => {
    if (event.target.dataset.canvasMenuName === undefined || !openId) return;
    onAction('rename', openId, event.target.value);
  });
  /** The typed name, if it is not the one already stored. */
  function pendingName(id) {
    const input = node.querySelector('[data-canvas-menu-name]');
    if (!input) return null;
    const current = layerOf(id)?.name || id;
    return input.value !== current ? input.value : null;
  }
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
    if (event.key === 'Enter' && event.target.dataset.canvasMenuName !== undefined) { event.preventDefault(); onAction('rename', openId, event.target.value); close(); }
  });
  // A press anywhere else is a press on the mascot, not on the menu.
  document.addEventListener('pointerdown', (event) => { if (!node.hidden && !node.contains(event.target)) close(); }, true);

  function render(id, { patch = false } = {}) {
    const document_ = state();
    const element = document_.elements?.[id];
    if (!element) return false;
    const layer = layerOf(id);
    const part = getPart(id);
    // A clip is invisible until something says so, and an author redrawing the
    // hair taller has to be able to find the thing that is cutting it. Taking
    // it off puts that shape back in the drawing, so a cut can be changed and
    // not only removed; making one is the Select tool's "Cut to top".
    const clip = getClip(id);
    const locked = Boolean(document_.layerMetadata?.[id]?.locked);
    const visible = layer ? layer.visible !== false : true;
    const name = layer?.name || id;
    const offered = getActions(id) || [];
    if (!offered.length) return false;
    // Rebuilding while a press is in flight destroys the button it started on,
    // and the click never lands. A refresh of the same piece patches instead.
    if (patch && node.dataset.canvasMenuFor === id) {
      const input = node.querySelector('[data-canvas-menu-name]');
      if (input && input !== node.ownerDocument.activeElement) input.value = name;
      for (const item of offered) {
        const button = node.querySelector(`[data-canvas-menu-action="${item.id}"] [data-canvas-menu-label]`);
        if (button) button.textContent = item.label;
      }
      return true;
    }
    const button = (item) => `<button type="button" data-canvas-menu-action="${esc(item.id)}"${item.danger ? ' class="danger"' : ''}>${item.glyph ? `<span class="canvas-menu-glyph" aria-hidden="true">${item.glyph}</span>` : ''}<span data-canvas-menu-label>${esc(item.label)}</span>${item.keys ? `<kbd>${esc(item.keys)}</kbd>` : ''}${item.hint ? `<small>${esc(item.hint)}</small>` : ''}</button>`;
    // The everyday actions are the menu; the rest fold into a disclosure under
    // them, so the first thing read is Duplicate and not "Convert to a path".
    //
    // Where the fold falls is the **surface's** depth, not a fixed level. In
    // Artwork, *Isolate* and *Send to back* are everyday and only the rigging
    // words fold; in Design ▸ Face the six simple gestures are the menu and
    // everything else — including Isolate, which the audit wanted exposed and
    // which the simple depth had been dropping on the floor — is one press
    // further down rather than absent (audit §5).
    // Never past `more`: the actions that name a rigging concept fold on every
    // surface, Artwork included, because that is what keeps *Duplicate* the
    // first thing read rather than *Convert to a path*.
    const ceiling = Math.min(LEVEL_RANK[depth()] ?? LEVEL_RANK.advanced, LEVEL_RANK.more);
    const everyday = offered.filter((item) => (LEVEL_RANK[item.level] ?? 9) <= ceiling);
    const expert = offered.filter((item) => (LEVEL_RANK[item.level] ?? 9) > ceiling);
    node.setAttribute('aria-label', `Edit ${name}`);
    node.innerHTML = `<div class="canvas-menu-head">
        <label class="small" for="canvas-menu-name">Name</label>
        <input id="canvas-menu-name" data-canvas-menu-name value="${esc(name)}" aria-label="Name of this piece of artwork">
        <p class="small" data-canvas-menu-part>${part ? `Part of <b>${esc(part.name)}</b>` : 'Not assigned to a face part'}</p>
        ${clip ? `<p class="small" data-canvas-menu-clip>Cut to the shape of <b>${esc(clip.clipId)}</b>${clip.self ? '' : ` (on ${esc(clip.ownerId || 'a group above it')})`}</p>` : ''}
        ${locked ? '<p class="small" data-canvas-menu-locked>Locked: unlock it to move, reshape or delete it.</p>' : ''}
        ${visible ? '' : '<p class="small" data-canvas-menu-hidden>Hidden on the mascot.</p>'}
      </div>
      <div class="canvas-menu-actions">${everyday.map(button).join('')}</div>
      ${expert.length ? `<details class="canvas-menu-advanced" data-canvas-menu-advanced><summary>Advanced</summary><div class="canvas-menu-actions">${expert.map(button).join('')}</div></details>` : ''}`;
    return true;
  }

  /**
   * Put it over the artwork it edits, and keep **all of it** inside the canvas.
   *
   * Clamping the top was not enough. A dozen actions, a name field and a
   * disclosure come to some eight hundred pixels, which is taller than the
   * canvas on any laptop: `box.height - size.height` went negative, the clamp
   * pinned the menu to the top, and everything past *Advanced* was off the
   * bottom of the window with no way to reach it — not scrolled, just gone.
   *
   * So the height is capped to the room there is and the menu scrolls inside
   * it. The cap is measured rather than guessed, because the canvas is
   * resizable (docs/DESIGN_SCREENS.md), and it is reapplied when a disclosure
   * opens — which is the one press that can make the menu taller than it was
   * when it was placed.
   */
  let anchor = null;
  function place(point) {
    if (point) anchor = point;
    if (!anchor) return;
    const box = host.getBoundingClientRect();
    node.hidden = false;
    node.style.maxHeight = `${Math.max(120, box.height - 16)}px`;
    const size = node.getBoundingClientRect();
    const x = Math.max(8, Math.min(anchor.x - box.left, box.width - size.width - 8));
    const y = Math.max(8, Math.min(anchor.y - box.top, box.height - size.height - 8));
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
  }
  // Opening *Advanced* adds to the menu's height, which can push its own foot
  // off the canvas. `toggle` fires after the box has changed, so re-placing
  // here keeps the whole of it reachable.
  node.addEventListener('toggle', () => { if (!node.hidden) place(null); }, true);

  function open(id, point) {
    if (!render(id)) return false;
    openId = id;
    select(id);
    place(point);
    node.dataset.canvasMenuFor = id;
    node.querySelector('[data-canvas-menu-name]')?.focus();
    return true;
  }

  function close() {
    if (node.hidden) return false;
    // A press outside closes the dialog before the input's `change` fires, so
    // the typed name was thrown away. Commit it here instead.
    const pending = pendingName(openId);
    if (pending !== null) onAction('rename', openId, pending);
    node.hidden = true;
    anchor = null;
    openId = null;
    delete node.dataset.canvasMenuFor;
    onClose();
    return true;
  }

  return {
    open,
    close,
    isOpen: () => !node.hidden,
    openFor: (id) => openId,
    /** Re-read the document, so a rename or a lock shows without reopening. */
    refresh() { if (openId) render(openId, { patch: true }); }
  };
}
