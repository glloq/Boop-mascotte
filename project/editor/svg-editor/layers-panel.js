const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/**
 * A shape mark instead of the old `[G]` / `[C]` prefix: the letter codes were
 * SVG jargon in the one label a beginner reads most, and the full type is on
 * the row's tooltip anyway.
 */
const TYPE_GLYPH = Object.freeze({ g: '▣', path: '✒', rect: '▭', circle: '●', ellipse: '⬭', line: '╲', polygon: '⬟', polyline: '⌇', text: 'T', image: '▤', use: '⧉' });
const TYPE_NAMES = Object.freeze({ g: 'group', path: 'path', rect: 'rectangle', circle: 'circle', ellipse: 'ellipse', line: 'line', polygon: 'polygon', polyline: 'polyline', text: 'text', image: 'image', use: 'copy' });
const typeLabel = (type) => TYPE_NAMES[type] || type;

export function createLayersPanel(leftSidebarEl, store, history, canvas) {
  const host = leftSidebarEl.querySelector('#layers-panel');
  if (!host) throw new Error('Missing required UI element: #layers-panel');
  let filter = '', focusedId = null;
  const collapsed = new Set();

  const select = (id) => store.mutateSession('selectedId', state => { state.selectedId = id; });
  host.addEventListener('click', (event) => {
    // A row's label holds the shape mark, the name and the part badge, so the
    // click can land on a child: ask the button, not whatever was under the
    // pointer.
    const { action, id } = event.target.closest('[data-action]')?.dataset || {};
    if (!id) return;
    if (action === 'select') { focusedId = id; select(id); render(); return; }
    if (action === 'toggle') { collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); render(id); return; }
    if (action === 'up' || action === 'down') { history.snapshot(); canvas.reorder(id, action); return; }
    if (action === 'visibility') { history.snapshot(); canvas.setVisibility(id, !findLayer(store.getState().layers, id)?.visible); return; }
    if (action === 'duplicate') { canvas.duplicate(id); return; }
    if (action === 'delete') { canvas.delete(id); return; }
    if (action === 'group') { canvas.group(id); return; }
    if (action === 'ungroup') { canvas.ungroup(id); return; }
    if (action === 'lock') { history.snapshot(); canvas.setLocked(id, !store.getState().layerMetadata[id]?.locked); }
  });
  host.addEventListener('input', (event) => {
    if (event.target.id === 'layer-filter') { filter = event.target.value.trim().toLowerCase(); render(); }
  });
  host.addEventListener('change', (event) => {
    if (event.target.dataset.action === 'rename') { history.snapshot(); canvas.setName(event.target.dataset.id, event.target.value); }
  });
  host.addEventListener('keydown', (event) => {
    const item = event.target.closest('[role=treeitem]');
    if (!item) return;
    const id = item.dataset.layerId, visible = visibleItems(store.getState().layers), index = visible.findIndex(entry => entry.item.id === id);
    let target;
    if (event.key === 'ArrowDown') target = visible[index + 1]?.item.id;
    if (event.key === 'ArrowUp') target = visible[index - 1]?.item.id;
    if (event.key === 'Home') target = visible[0]?.item.id;
    if (event.key === 'End') target = visible.at(-1)?.item.id;
    const layer = findLayer(store.getState().layers, id);
    if (event.key === 'ArrowRight' && layer?.children.length) {
      if (collapsed.has(id)) { collapsed.delete(id); render(id); } else target = layer.children[0]?.id;
    }
    if (event.key === 'ArrowLeft') {
      if (layer?.children.length && !collapsed.has(id)) { collapsed.add(id); render(id); }
      else target = visible[index]?.parentId;
    }
    if (event.key === 'Enter' || event.key === ' ') { select(id); render(id); }
    if (target) { focusedId = target; render(target); }
    if (target || ['ArrowRight','ArrowLeft','Enter',' '].includes(event.key)) event.preventDefault();
  });

  function matches(item) { return !filter || `${item.name} ${item.id} ${item.type}`.toLowerCase().includes(filter) || item.children.some(matches); }
  function row(item, depth) {
    if (!matches(item)) return '';
    const state=store.getState(), metadata=state.layerMetadata[item.id] || {}, part=Object.values(state.semanticParts||{}).find(candidate=>Object.values(candidate.roles||{}).includes(item.id));
    const expanded = Boolean(filter) || !collapsed.has(item.id), selected=state.selectedId === item.id;
    return `<div role="treeitem" aria-level="${depth + 1}" aria-selected="${selected}" ${item.children.length?`aria-expanded="${expanded}"`:''} tabindex="${focusedId === item.id || (!focusedId && selected) ? '0' : '-1'}" data-layer-id="${escapeHtml(item.id)}" class="layer-item ${selected?'active':''}" style="${depth ? 'margin-left:11px' : ''}"><div class="layer-row">${item.children.length?`<button class="layer-icon" tabindex="-1" data-action="toggle" data-id="${escapeHtml(item.id)}" aria-label="${expanded?'Collapse':'Expand'} ${escapeHtml(item.name)}">${expanded?'▼':'▶'}</button>`:'<span class="layer-spacer"></span>'}<button class="layer-label" tabindex="-1" data-action="select" data-id="${escapeHtml(item.id)}" title="${escapeHtml(item.name)} — ${escapeHtml(typeLabel(item.type))}${part?` · ${escapeHtml(part.name)}`:''}"><span class="layer-type" aria-hidden="true">${TYPE_GLYPH[item.type]||'◆'}</span><span class="layer-name">${escapeHtml(item.name)}</span>${part?`<span class="semantic-badge">${escapeHtml(part.name)}</span>`:''}</button><button class="layer-icon" tabindex="-1" data-action="visibility" data-id="${escapeHtml(item.id)}" title="Visibility">${item.visible?'◉':'○'}</button><button class="layer-icon" tabindex="-1" data-action="lock" data-id="${escapeHtml(item.id)}" title="Lock">${metadata.locked?'🔒':'🔓'}</button></div>${selected?`<input data-action="rename" data-id="${escapeHtml(item.id)}" aria-label="Layer display name" value="${escapeHtml(item.name)}"><div class="layer-actions"><button data-action="up" data-id="${escapeHtml(item.id)}" aria-label="Move ${escapeHtml(item.name)} up">↑ Up</button><button data-action="down" data-id="${escapeHtml(item.id)}" aria-label="Move ${escapeHtml(item.name)} down">↓ Down</button><button data-action="duplicate" data-id="${escapeHtml(item.id)}">Duplicate</button><button data-action="${item.type==='g'?'ungroup':'group'}" data-id="${escapeHtml(item.id)}">${item.type==='g'?'Ungroup':'Group'}</button><button class="danger" data-action="delete" data-id="${escapeHtml(item.id)}">Delete</button></div><div class="small">ID: ${escapeHtml(item.id)}</div>`:''}${expanded?item.children.map(child=>row(child,depth+1)).join(''):''}</div>`;
  }
  function render(focusAfter) {
    const tree=store.getState().layers, count=flatten(tree).length;
    host.innerHTML=`<h3 id="layers-heading">Layers <span class="small">(${count})</span></h3><input id="layer-filter" aria-label="Search layers" placeholder="Search name, id or type…" value="${escapeHtml(filter)}"><div role="tree" aria-labelledby="layers-heading">${tree.map(item=>row(item,0)).join('')||'<p class="small">No layers match filter.</p>'}</div>`;
    if (focusAfter) requestAnimationFrame(()=>host.querySelector(`[data-layer-id="${CSS.escape(focusAfter)}"]`)?.focus());
  }
  return { render };
  function visibleItems(tree, parentId=null) { return tree.flatMap(item=>[{item,parentId}, ...(collapsed.has(item.id)?[]:visibleItems(item.children||[],item.id))]); }
}
function flatten(tree) { return tree.flatMap(item=>[item,...flatten(item.children||[])]); }
function findLayer(tree,id) { return flatten(tree).find(item=>item.id===id); }
