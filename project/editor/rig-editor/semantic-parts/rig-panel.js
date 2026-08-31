import { SEMANTIC_PART_REGISTRY } from './part-registry.js';
import { assignSemanticRole, createSemanticPart, enableSemanticControl, removeSemanticPart } from './part-model.js';
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label = (name) => name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
export function createRigPanel(host, store, history, preview, onControlCommit = () => {}) {
  let selectedPart = null;
  host.addEventListener('click', (event) => {
    const state = store.getState();
    if (event.target.id === 'add-semantic-part') { const type = host.querySelector('#part-type').value; history.snapshot(); store.setState((draft) => { const part=createSemanticPart(draft,type); selectedPart=part.id; }); }
    if (event.target.dataset.part) { selectedPart=event.target.dataset.part; render(); }
    if (event.target.dataset.assignRole) { if (!state.selectedId) return; history.snapshot(); store.setState((draft) => assignSemanticRole(draft, selectedPart, event.target.dataset.assignRole, state.selectedId)); }
    if (event.target.dataset.clearRole) { history.snapshot(); store.setState((draft) => assignSemanticRole(draft, selectedPart, event.target.dataset.clearRole, null)); }
    if (event.target.dataset.enableControl) { history.snapshot(); store.setState((draft) => enableSemanticControl(draft, selectedPart, event.target.dataset.enableControl)); }
    if (event.target.id === 'delete-semantic-part') { history.snapshot(); store.setState((draft) => removeSemanticPart(draft, selectedPart)); selectedPart=null; }
    if (event.target.id === 'test-blink') { preview.setLiveParam('eyeOpen',0); setTimeout(()=>preview.clearLiveParam('eyeOpen'),140); }
    if (event.target.dataset.capture) { history.snapshot(); store.setState((draft) => { const part=draft.semanticParts[selectedPart]; part.calibration[event.target.dataset.capture]=Object.fromEntries(Object.entries(part.roles).map(([role,id])=>[role,structuredClone(draft.elements[id]?.baseTransform||{})])); }); }
  });
  host.addEventListener('input', (event) => { if (event.target.dataset.control) preview.setLiveParam(event.target.dataset.control, event.target.value); });
  host.addEventListener('change', (event) => { const name=event.target.dataset.control; if (!name) return; history.snapshot(); store.setState((draft)=>{ draft.params[name].value=Number(event.target.value); }); preview.clearLiveParam(name); onControlCommit(name,Number(event.target.value)); });
  function render() {
    const state=store.getState(), parts=state.semanticParts||{}; if (!parts[selectedPart]) selectedPart=Object.keys(parts)[0]||null;
    const part=parts[selectedPart], def=part&&SEMANTIC_PART_REGISTRY[part.type];
    host.innerHTML=`<h3>Rig</h3><div class="inline"><select id="part-type">${Object.entries(SEMANTIC_PART_REGISTRY).map(([id,d])=>`<option value="${id}">${esc(d.displayName)}</option>`).join('')}</select><button id="add-semantic-part">+ Add Part</button></div><div class="chip-row">${Object.values(parts).map((p)=>`<button class="chip ${p.id===selectedPart?'chip-active':''}" data-part="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>${part?`<div class="manager-card"><div class="card-title"><strong>${esc(def.displayName)}</strong><button id="delete-semantic-part" class="icon danger">Delete Part</button></div><p class="small">Select artwork on the canvas, then assign it—no SVG ID typing.</p>${def.roles.map((role)=>`<div class="role-row"><span>${part.roles[role]?'✓':'⚠'} ${label(role)} <small>${esc(part.roles[role]||'missing')}</small></span><span><button data-assign-role="${role}" ${state.selectedId?'':'disabled'}>Assign selected</button>${part.roles[role]?`<button class="secondary" data-clear-role="${role}">Clear</button>`:''}</span></div>`).join('')}<h4>Graphical controls</h4>${def.controls.map((control)=>part.controls.includes(control)?`<label>${label(control)} <output>${Number(state.params[control]?.value??0).toFixed(2)}</output><input data-control="${control}" type="range" min="${state.params[control].min}" max="${state.params[control].max}" step=".01" value="${state.params[control].value}"></label>`:`<button data-enable-control="${control}">Enable ${label(control)}</button>`).join(' ')}${part.controls.includes('eyeOpen')?'<button id="test-blink" class="secondary">Test Blink</button>':''}<details><summary>Calibration</summary>${['center','left','right','up','down'].map((point)=>`<button data-capture="${point}" class="secondary">Capture ${point.toUpperCase()}</button>`).join('')}<p class="small">Captures authored transforms reversibly in part metadata.</p></details></div>`:'<p class="small">Add a body part to begin simple rigging.</p>'}`;
  }
  return { render };
}
