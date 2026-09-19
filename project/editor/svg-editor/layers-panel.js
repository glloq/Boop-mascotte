import { selectOnly, toggleSelected } from '../core/state/selection.js';
import { esc } from '../ui/escape-html.js';
import { describeCut, readCuts } from '../core/artwork/cuts.js';

/**
 * A shape mark instead of the old `[G]` / `[C]` prefix: the letter codes were
 * SVG jargon in the one label a beginner reads most, and the full type is on
 * the row's tooltip anyway.
 */
const TYPE_GLYPH = Object.freeze({ g: '▣', path: '✒', rect: '▭', circle: '●', ellipse: '⬭', line: '╲', polygon: '⬟', polyline: '⌇', text: 'T', image: '▤', use: '⧉' });
const TYPE_NAMES = Object.freeze({ g: 'group', path: 'path', rect: 'rectangle', circle: 'circle', ellipse: 'ellipse', line: 'line', polygon: 'polygon', polyline: 'polyline', text: 'text', image: 'image', use: 'copy' });
const typeLabel = (type) => TYPE_NAMES[type] || type;

/**
 * The identifier a piece carries in the SVG.
 *
 * It was a line of text under every selected row — `ID: eyeLeft` — which is the
 * one thing in this panel that is not about the drawing. It matters: it is what
 * an exported `rig.json` names, what a validation message quotes, and what
 * somebody writing their own runtime binding needs. It simply does not belong
 * in front of everybody who ever clicks a layer
 * (docs/AUDIT_UI_2026-09/01_ETAT_ACTUEL.md §12).
 */
export function createLayersPanel(leftSidebarEl, store, history, canvas) {
  const host = leftSidebarEl.querySelector('#layers-panel');
  if (!host) throw new Error('Missing required UI element: #layers-panel');
  let filter = '', focusedId = null;
  const collapsed = new Set();
  /**
   * The cuts in the artwork, read once per render rather than once per row.
   *
   * Derived from the markup, which is where a clip lives: a `<clipPath>` is in
   * neither `layers` nor `elements`, so there is nothing else to ask.
   */
  let cutsFor = { markup: null, value: { byPiece: {}, byCutter: {} } };
  const cuts = () => {
    const markup = store.getState().svgMarkup || '';
    if (cutsFor.markup !== markup) cutsFor = { markup, value: readCuts(markup) };
    return cutsFor.value;
  };

  // Shift, Ctrl or Cmd adds a row to the selection, or takes it back out.
  const select = (id, extend = false) => store.mutateSession(['selectedId', 'selectedIds'], state => { Object.assign(state, extend ? toggleSelected(state, id) : selectOnly(id)); });
  host.addEventListener('click', (event) => {
    // A row's label holds the shape mark, the name and the part badge, so the
    // click can land on a child: ask the button, not whatever was under the
    // pointer.
    const { action, id } = event.target.closest('[data-action]')?.dataset || {};
    if (!id) return;
    if (action === 'select') { focusedId = id; select(id, Boolean(event.shiftKey || event.ctrlKey || event.metaKey)); render(); return; }
    // The shape a piece is cut to is a drawing like any other, so the badge
    // that names it goes to it: that is the whole of "where is the cut"
    // (docs/VECTOR_EDITING.md).
    if (action === 'cutter') { focusedId = id; select(id); render(); return; }
    if (action === 'toggle') { collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); render(id); return; }
    // "Forward" and "backward" are paint order, the same words and the same
    // direction as the canvas menu: painted later is painted in front, which is
    // *later* among the siblings. "Up"/"Down" here used to move the layer the
    // opposite way from the menu's buttons for the same job.
    if (action === 'forward' || action === 'backward') {
      const position = siblingPosition(store.getState().layers, id);
      const room = action === 'forward' ? position && position.index < position.count - 1 : position && position.index > 0;
      if (!room) return;
      history.snapshot(); canvas.reorder(id, action === 'forward' ? 'down' : 'up'); return;
    }
    if (action === 'front' || action === 'back') { if (canvas.reorderToEnd?.(id, action)) return; return; }
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
    /**
     * What is cutting this piece, and what this piece cuts.
     *
     * A clip was the one thing in the artwork with nowhere to appear: an
     * attribute pointing at a `<clipPath>`, which is in no layer and no
     * `elements` record. So the fringe arrived cut to the head and the tree
     * said nothing about it. The badge says it, and goes to the shape.
     */
    const cut = describeCut(cuts(), item.id, (id) => findLayer(state.layers, id)?.name);
    // A mark rather than a sentence: the tree is a column of names two hundred
    // and seventy pixels wide, and a badge reading "✂ Head shape" ate the name
    // it was standing next to. The mark says *there is a cut here*, its colour
    // says which end of it this row is, and the row that is open says the rest
    // in words -- which is where an author is already looking when they act.
    const cutHint = cut.cutBy
      ? (cut.cutBy.named
        ? `${item.name} is cut to the shape of ${cut.cutBy.shapeName}${cut.cutBy.hidden ? `, and ${cut.cutBy.shapeName} is hidden — so none of ${item.name} shows` : ''}.`
        : `${item.name} is cut to a shape with no name of its own, so there is nothing to go to.`)
      : cut.cutting ? `${item.name} cuts ${cut.cutting.join(', ')}. Hide it and they go with it.` : '';
    const cutBadge = cut.cutBy
      ? (cut.cutBy.named
        ? `<button class="cut-badge${cut.cutBy.hidden ? ' cut-badge-lost' : ''}" tabindex="-1" data-action="cutter" data-id="${esc(cut.cutBy.shapeId)}" aria-label="${esc(cutHint)} Press to go to it." title="${esc(cutHint)} Press to go to it.">✂</button>`
        // Muted, not red: a cut whose shape lives inside it is what **Cut to
        // top** makes, and it is a decision rather than a fault. Red is kept
        // for the one state that really is broken on screen.
        : `<span class="cut-badge cut-badge-anon" role="img" aria-label="${esc(cutHint)}" title="${esc(cutHint)} “Stop cutting it” brings the shape back into the drawing.">✂</span>`)
      : cut.cutting
        ? `<span class="cut-badge cut-badge-cutter" role="img" aria-label="${esc(cutHint)}" title="${esc(cutHint)}">✂ ${cut.cutting.length}</span>`
        : '';
    /** The same thing in words, in the open row, where there is room for them. */
    const cutLine = cut.cutBy
      ? (cut.cutBy.named
        ? `<p class="small layer-cut">✂ Cut to the shape of <button class="layer-cut-go" data-action="cutter" data-id="${esc(cut.cutBy.shapeId)}">${esc(cut.cutBy.shapeName)}</button>${cut.cutBy.hidden ? ', which is hidden — so none of this shows' : ''}.</p>`
        : '<p class="small layer-cut">✂ Cut to a shape with no name of its own. <i>Stop cutting it</i> brings the shape back into the drawing, where it can be redrawn and used to cut again.</p>')
      : cut.cutting
        ? `<p class="small layer-cut">✂ This shape cuts ${esc(cut.cutting.join(', '))}. Hide it and they go with it.</p>`
        : '';
    const expanded = Boolean(filter) || !collapsed.has(item.id), selected=state.selectedId === item.id, inSelection = selected || (state.selectedIds || []).includes(item.id);
    return `<div role="treeitem" aria-level="${depth + 1}" aria-selected="${inSelection}" ${item.children.length?`aria-expanded="${expanded}"`:''} tabindex="${focusedId === item.id || (!focusedId && selected) ? '0' : '-1'}" data-layer-id="${esc(item.id)}" class="layer-item ${selected?'active':''} ${inSelection && !selected ? 'in-selection' : ''}" style="${depth ? 'margin-left:11px' : ''}"><div class="layer-row">${item.children.length?`<button class="layer-icon" tabindex="-1" data-action="toggle" data-id="${esc(item.id)}" aria-label="${expanded?'Collapse':'Expand'} ${esc(item.name)}">${expanded?'▼':'▶'}</button>`:'<span class="layer-spacer"></span>'}<button class="layer-label" tabindex="-1" data-action="select" data-id="${esc(item.id)}" title="${esc(item.name)} — ${esc(typeLabel(item.type))}${part?` · ${esc(part.name)}`:''}"><span class="layer-type" aria-hidden="true">${TYPE_GLYPH[item.type]||'◆'}</span><span class="layer-name">${esc(item.name)}</span>${part?`<span class="semantic-badge">${esc(part.name)}</span>`:''}</button>${cutBadge}<button class="layer-icon" tabindex="-1" data-action="visibility" data-id="${esc(item.id)}" title="Visibility">${item.visible?'◉':'○'}</button><button class="layer-icon" tabindex="-1" data-action="lock" data-id="${esc(item.id)}" title="Lock">${metadata.locked?'🔒':'🔓'}</button></div>${selected?`<input data-action="rename" data-id="${esc(item.id)}" aria-label="Layer display name" value="${esc(item.name)}">${cutLine}<div class="layer-actions"><button data-action="forward" data-id="${esc(item.id)}" aria-label="Bring ${esc(item.name)} forward" title="Paint it in front of the next piece">Bring forward</button><button data-action="backward" data-id="${esc(item.id)}" aria-label="Send ${esc(item.name)} backward" title="Paint it behind the previous piece">Send backward</button><button data-action="front" data-id="${esc(item.id)}" aria-label="Bring ${esc(item.name)} to the front">To front</button><button data-action="back" data-id="${esc(item.id)}" aria-label="Send ${esc(item.name)} to the back">To back</button><button data-action="duplicate" data-id="${esc(item.id)}">Duplicate</button><button data-action="${item.type==='g'?'ungroup':'group'}" data-id="${esc(item.id)}">${item.type==='g'?'Ungroup':'Group'}</button><button class="danger" data-action="delete" data-id="${esc(item.id)}">Delete</button></div><details class="layer-id"><summary>Identifier</summary><code>${esc(item.id)}</code></details>`:''}${expanded?item.children.map(child=>row(child,depth+1)).join(''):''}</div>`;
  }
  function render(focusAfter) {
    const tree=store.getState().layers, count=flatten(tree).length;
    host.innerHTML=`<h3 id="layers-heading">Layers <span class="small">(${count})</span></h3><input id="layer-filter" aria-label="Search layers" placeholder="Search name, id or type…" value="${esc(filter)}"><div role="tree" aria-labelledby="layers-heading">${tree.map(item=>row(item,0)).join('')||'<p class="small">No layers match filter.</p>'}</div>`;
    if (focusAfter) requestAnimationFrame(()=>host.querySelector(`[data-layer-id="${CSS.escape(focusAfter)}"]`)?.focus());
  }
  return { render };
  function visibleItems(tree, parentId=null) { return tree.flatMap(item=>[{item,parentId}, ...(collapsed.has(item.id)?[]:visibleItems(item.children||[],item.id))]); }
}
function flatten(tree) { return tree.flatMap(item=>[item,...flatten(item.children||[])]); }
function findLayer(tree,id) { return flatten(tree).find(item=>item.id===id); }
/** Where a piece sits among the siblings it is painted with. */
export function siblingPosition(items, id) {
  const list = items || [];
  const index = list.findIndex((item) => item.id === id);
  if (index >= 0) return { index, count: list.length };
  for (const item of list) { const found = siblingPosition(item.children, id); if (found) return found; }
  return null;
}
