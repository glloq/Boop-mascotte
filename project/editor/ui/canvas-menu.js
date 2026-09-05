const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

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
 * handful of things one does to a piece of artwork. Everything here already
 * existed in the Layers panel — what was missing is reaching it from the
 * mascot rather than from a tree of thirty rows.
 *
 * It is a dialog rather than a `menu`, because renaming is a text field and a
 * menu with an input in it is neither one thing nor the other.
 */
export function createCanvasMenu(host, {
  getState = () => ({}), getPart = () => null, getClip = () => null, select = () => {}, onAction = () => {}, onClose = () => {}
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
    // hair taller has to be able to find the thing that is cutting it.
    const clip = getClip(id);
    const locked = Boolean(document_.layerMetadata?.[id]?.locked);
    const visible = layer ? layer.visible !== false : true;
    // A locked piece is not editable, so it is not offered a node editor: the
    // Node tool would happily reshape it anyway.
    const isPath = (layer?.type || element.meta?.nodeType) === 'path' && !locked;
    const isShape = ['rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline'].includes(layer?.type || element.meta?.nodeType) && !locked;
    const name = layer?.name || id;
    // Rebuilding while a press is in flight destroys the button it started on,
    // and the click never lands. A refresh of the same piece patches instead.
    if (patch && node.dataset.canvasMenuFor === id) {
      const input = node.querySelector('[data-canvas-menu-name]');
      if (input && input !== node.ownerDocument.activeElement) input.value = name;
      const label = (key, text) => { const button = node.querySelector(`[data-canvas-menu-action="${key}"]`); if (button) button.textContent = text; };
      label('visibility', visible ? 'Hide' : 'Show');
      label('lock', locked ? 'Unlock' : 'Lock');
      return true;
    }
    const action = (key, label, { danger = false, hint = '' } = {}) =>
      `<button type="button" data-canvas-menu-action="${key}"${danger ? ' class="danger"' : ''}>${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ''}</button>`;
    node.setAttribute('aria-label', `Edit ${name}`);
    node.innerHTML = `<div class="canvas-menu-head">
        <label class="small" for="canvas-menu-name">Name</label>
        <input id="canvas-menu-name" data-canvas-menu-name value="${esc(name)}" aria-label="Name of this piece of artwork">
        <p class="small" data-canvas-menu-part>${part ? `Part of <b>${esc(part.name)}</b>` : 'Not assigned to a face part'}</p>
        ${clip ? `<p class="small" data-canvas-menu-clip>Cut to the shape of <b>${esc(clip.clipId)}</b>${clip.self ? '' : ` (on ${esc(clip.ownerId || 'a group above it')})`}</p>` : ''}
      </div>
      <div class="canvas-menu-actions">
        ${part ? action('part', `Open ${part.name}`, { hint: 'Face Setup' }) : action('assign', 'Assign to a face part', { hint: 'Face Setup' })}
        ${isPath ? action('points', 'Edit points', { hint: 'Node tool' }) : ''}
        ${isPath ? action('pin', 'Add a pin here', { hint: 'Pins & holding' }) : ''}
        ${isShape ? action('to-path', 'Convert to a path', { hint: 'For points, pins and shape keys' }) : ''}
        ${clip ? action('release-clip', 'Stop cutting it', { hint: 'Remove the clip' }) : ''}
        ${action('duplicate', 'Duplicate')}
        ${action('forward', 'Bring forward')}
        ${action('backward', 'Send backward')}
        ${action('front', 'Bring to front')}
        ${action('back', 'Send to back')}
        ${action('flip-x', 'Flip horizontally')}
        ${action('flip-y', 'Flip vertically')}
        ${action('visibility', visible ? 'Hide' : 'Show')}
        ${action('lock', locked ? 'Unlock' : 'Lock')}
        ${action('delete', 'Delete', { danger: true })}
      </div>`;
    return true;
  }

  /** Put it over the artwork it edits, and keep it inside the canvas. */
  function place(point) {
    const box = host.getBoundingClientRect();
    node.hidden = false;
    const size = node.getBoundingClientRect();
    const x = Math.max(8, Math.min(point.x - box.left, box.width - size.width - 8));
    const y = Math.max(8, Math.min(point.y - box.top, box.height - size.height - 8));
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
  }

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
