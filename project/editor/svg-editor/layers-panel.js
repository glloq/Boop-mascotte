const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function createLayersPanel(leftSidebarEl, store, history, canvas) {
  const host = document.createElement('div');
  host.id = 'layers-panel';
  leftSidebarEl.appendChild(document.createElement('hr'));
  leftSidebarEl.appendChild(host);
  let filter = '';

  host.addEventListener('click', (event) => {
    const { action, id } = event.target.dataset;
    if (!id) return;
    if (action === 'select') { store.setState((state) => { state.selectedId = id; }); return; }
    if (action === 'toggle') { history.snapshot(); const item = findLayer(store.getState().layers, id); canvas.setExpanded(id, item?.expanded === false); return; }
    if (action === 'up' || action === 'down') { history.snapshot(); canvas.reorder(id, action); return; }
    if (action === 'visibility') { history.snapshot(); const item = findLayer(store.getState().layers, id); canvas.setVisibility(id, !item?.visible); return; }
    if (action === 'lock') { history.snapshot(); canvas.setLocked(id, !store.getState().layerMetadata[id]?.locked); }
  });

  host.addEventListener('input', (event) => {
    if (event.target.id === 'layer-filter') { filter = event.target.value.trim().toLowerCase(); render(); }
    if (event.target.dataset.action === 'rename') { history.snapshot(); canvas.setName(event.target.dataset.id, event.target.value); }
  });

  function matches(item) {
    return !filter || `${item.name} ${item.id} ${item.type}`.toLowerCase().includes(filter) || item.children.some(matches);
  }
  function row(item, depth) {
    if (!matches(item)) return '';
    const metadata = store.getState().layerMetadata[item.id] || {};
    const expanded = filter || metadata.expanded !== false;
    return `<div class="layer-item ${store.getState().selectedId === item.id ? 'active' : ''}" style="margin-left:${depth * 12}px">
      <div class="layer-row">
        ${item.children.length ? `<button class="layer-icon" data-action="toggle" data-id="${escapeHtml(item.id)}">${expanded ? '▼' : '▶'}</button>` : '<span class="layer-spacer"></span>'}
        <button class="layer-label" data-action="select" data-id="${escapeHtml(item.id)}"><small>[${escapeHtml(item.type[0].toUpperCase())}]</small> ${escapeHtml(item.name)}</button>
        <button class="layer-icon" data-action="visibility" data-id="${escapeHtml(item.id)}" title="Visibility">${item.visible ? '◉' : '○'}</button>
        <button class="layer-icon" data-action="lock" data-id="${escapeHtml(item.id)}" title="Lock">${metadata.locked ? '🔒' : '🔓'}</button>
        <button class="layer-icon" data-action="up" data-id="${escapeHtml(item.id)}">↑</button><button class="layer-icon" data-action="down" data-id="${escapeHtml(item.id)}">↓</button>
      </div>
      ${store.getState().selectedId === item.id ? `<input data-action="rename" data-id="${escapeHtml(item.id)}" aria-label="Layer display name" value="${escapeHtml(item.name)}"><div class="small">ID: ${escapeHtml(item.id)}</div>` : ''}
    </div>${expanded ? item.children.map((child) => row(child, depth + 1)).join('') : ''}`;
  }

  function render() {
    const tree = store.getState().layers;
    const count = flatten(tree).length;
    host.innerHTML = `<h3>Layers <span class="small">(${count})</span></h3>
      <input id="layer-filter" placeholder="Filter name, id or type..." value="${escapeHtml(filter)}" />
      ${tree.map((item) => row(item, 0)).join('') || '<p class="small">No layers match filter.</p>'}`;
  }
  return { render };
}

function flatten(tree) { return tree.flatMap((item) => [item, ...flatten(item.children || [])]); }
function findLayer(tree, id) { return flatten(tree).find((item) => item.id === id); }
