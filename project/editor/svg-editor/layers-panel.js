const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function createLayersPanel(leftSidebarEl, store, history, canvas) {
  const host = leftSidebarEl.querySelector('#layers-panel');
  if (!host) throw new Error('Missing required UI element: #layers-panel');
  let filter = '';

  host.addEventListener('click', (event) => {
    const { action, id } = event.target.dataset;
    if (!id) return;
    if (action === 'select') { store.mutateSession('selectedId', state => { state.selectedId = id; }); return; }
    if (action === 'toggle') { history.snapshot(); const item = findLayer(store.getState().layers, id); canvas.setExpanded(id, item?.expanded === false); return; }
    if (action === 'up' || action === 'down') { history.snapshot(); canvas.reorder(id, action); return; }
    if (action === 'visibility') { history.snapshot(); const item = findLayer(store.getState().layers, id); canvas.setVisibility(id, !item?.visible); return; }
    if (action === 'duplicate') { canvas.duplicate(id); return; }
    if (action === 'delete') { canvas.delete(id); return; }
    if (action === 'group') { canvas.group(id); return; }
    if (action === 'ungroup') { canvas.ungroup(id); return; }
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
    const state=store.getState(),metadata = state.layerMetadata[item.id] || {},part=Object.values(state.semanticParts||{}).find(candidate=>Object.values(candidate.roles||{}).includes(item.id)),partLabel=part?part.name:'';
    const expanded = filter || metadata.expanded !== false;
    return `<div data-layer-id="${escapeHtml(item.id)}" class="layer-item ${store.getState().selectedId === item.id ? 'active' : ''}" style="margin-left:${depth * 12}px">
      <div class="layer-row">
        ${item.children.length ? `<button class="layer-icon" data-action="toggle" data-id="${escapeHtml(item.id)}">${expanded ? '▼' : '▶'}</button>` : '<span class="layer-spacer"></span>'}
        <button class="layer-label" data-action="select" data-id="${escapeHtml(item.id)}"><small>[${escapeHtml(item.type[0].toUpperCase())}]</small> ${escapeHtml(item.name)} ${partLabel?`<span class="semantic-badge">${escapeHtml(partLabel)}</span>`:''}</button>
        <button class="layer-icon" data-action="visibility" data-id="${escapeHtml(item.id)}" title="Visibility">${item.visible ? '◉' : '○'}</button>
        <button class="layer-icon" data-action="lock" data-id="${escapeHtml(item.id)}" title="Lock">${metadata.locked ? '🔒' : '🔓'}</button>
        <button class="layer-icon" data-action="up" data-id="${escapeHtml(item.id)}">↑</button><button class="layer-icon" data-action="down" data-id="${escapeHtml(item.id)}">↓</button>
      </div>
      ${store.getState().selectedId === item.id ? `<input data-action="rename" data-id="${escapeHtml(item.id)}" aria-label="Layer display name" value="${escapeHtml(item.name)}"><div class="layer-actions"><button data-action="duplicate" data-id="${escapeHtml(item.id)}">Duplicate</button><button data-action="${item.type==='g'?'ungroup':'group'}" data-id="${escapeHtml(item.id)}">${item.type==='g'?'Ungroup':'Group'}</button><button class="danger" data-action="delete" data-id="${escapeHtml(item.id)}">Delete</button></div><div class="small">ID: ${escapeHtml(item.id)}</div>` : ''}
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
