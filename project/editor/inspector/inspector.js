import { mirrorTransformX } from '../core/rig/symmetry.js';
import { PART_PRESETS, suggestPresetForElement } from '../core/assets/part-presets.js';
import { createArtworkCommands } from '../core/commands/artwork-commands.js';
import { rememberOpen, setPanelHtml } from '../ui/panel-render.js';
import { findSemanticPartByRole } from '../rig-editor/semantic-parts/part-model.js';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
/** `leftPupil` → `Left Pupil`. Role ids are camelCase and nothing else. */
const roleWords = (value) => String(value).replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());

const HEX6 = /^#[0-9a-f]{6}$/i, HEX3 = /^#[0-9a-f]{3}$/i;
/** A colour the `<input type=color>` can show, or null for none / a gradient / a name it cannot. */
export function paintToHex(value) {
  const text = String(value ?? '').trim();
  if (HEX6.test(text)) return text.toLowerCase();
  if (HEX3.test(text)) return `#${[...text.slice(1)].map((char) => char + char).join('')}`.toLowerCase();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(text) || /^rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)/i.exec(text);
  if (rgb) return `#${[rgb[1], rgb[2], rgb[3]].map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, '0')).join('')}`;
  return null;
}

/** Which appearance fields an element of this kind has, beyond fill, stroke and opacity. */
export function geometryFields(localName) {
  if (localName === 'rect') return [['width', 'Width', 'min="0" step="0.5"'], ['height', 'Height', 'min="0" step="0.5"'], ['rx', 'Corner radius', 'min="0" step="0.5"']];
  if (localName === 'circle') return [['r', 'Radius', 'min="0" step="0.5"']];
  if (localName === 'ellipse') return [['rx', 'Radius X', 'min="0" step="0.5"'], ['ry', 'Radius Y', 'min="0" step="0.5"']];
  if (localName === 'text') return [['font-size', 'Font size', 'min="1" step="1"']];
  return [];
}

/**
 * What the selected piece *is*, rather than what the SVG calls it.
 *
 * Everything below this line is a list of numbers — transform, appearance,
 * bindings — and a bare SVG id on top of it left the author checking the layer
 * tree to find out whether they were editing the mouth or the jaw. That is the
 * complaint VNX-11 exists for, and the document already holds the answer: a
 * face part owns the artwork that plays each of its roles.
 */
export function inspectorSubject(state, id) {
  const part = findSemanticPartByRole(state, id);
  const roles = part?.roles || {};
  return {
    name: state?.layerMetadata?.[id]?.name || id,
    part: part?.name || null,
    role: Object.keys(roles).find((role) => roles[role] === id) || null
  };
}

export function createInspector(host, store, history, canvas) {
  // The Inspector is rebuilt whenever the selection or the document changes:
  // the disclosures the author opened outlive it, and the view stays put.
  const sections = rememberOpen(host);
  // The tab strip picks what the Advanced disclosure shows. Transform and
  // Appearance were in it too and did nothing: both are rendered above it as
  // their own sections, and the tab body had no case for them, so opening
  // Advanced always landed on "Choose Bindings, Morph, or Presets".
  let activeTab = 'bindings';
  const commands=createArtworkCommands(store,history);
  /**
   * A render the panel owes once the author stops typing in it.
   *
   * Every field here writes the document, and every document write redraws
   * this panel. Redrawing it under the field being typed in threw the field
   * away after the first character: "none" became `fill="n"`, and focus was
   * gone. While the panel has focus its own edits are the only thing changing
   * the document, and the fields already show what was typed — so the redraw
   * waits until focus leaves.
   */
  let pendingRender = false;
  const hasFocusInside = () => {
    const active = globalThis.document?.activeElement;
    return Boolean(active && typeof host.contains === 'function' && host.contains(active) && active !== host);
  };
  const selectedElement = () => {
    const document = store.getDocument(), id = store.getSession().selectedId;
    return id && document.elements[id] ? { document, id, element: document.elements[id] } : null;
  };

  host.addEventListener('click', (event) => {
    const tab = event.target.dataset.tab;
    if (tab) {
      activeTab = tab;
      renderCurrent({ force: true });
      return;
    }
    if (event.target.dataset.convertPath !== undefined) {
      const id = store.getSession().selectedId;
      if (id) canvas.convertToPath?.(id);
      renderCurrent({ force: true });
      return;
    }
    if (event.target.id === 'apply-part-preset') {
      const document = store.getDocument(), id = store.getSession().selectedId;
      if (!id || !document.elements[id]) return;
      const presetId = host.querySelector('#part-preset-select')?.value;
      const preset = PART_PRESETS[presetId];
      if (!preset) return;
      commands.updateElement(id,'apply-preset',element=>preset.apply(element));
      canvas.applyElementTransform(id, store.getDocument().elements[id]);
      renderCurrent({ force: true });
      return;
    }
    if (event.target.id !== 'mirror-apply') return;
    const document=store.getDocument(), id=store.getSession().selectedId;
    if (!id) return;
    const src = document.elements[id];
    const peerId = src?.symmetryPeer;
    if (!peerId || !document.elements[peerId]) return;
    // The axis is the middle of the working area, not a number from the
    // default 240-wide artboard: a resized artboard used to mirror off-centre.
    const box = canvas.artboardReport?.()?.box;
    const mirrored = box ? mirrorTransformX(src, box.x + box.width / 2) : mirrorTransformX(src);
    commands.updateElement(peerId,'set-symmetry',element=>Object.assign(element,mirrored));
    canvas.applyElementTransform(peerId, store.getDocument().elements[peerId]);
  });

  // Colour pickers and sliders preview live and become one undo step: the
  // transaction opens when the field takes focus and closes when it leaves.
  host.addEventListener('focusin', (event) => { if (event.target.matches?.('[data-live]')) history.beginTransaction?.(); });
  host.addEventListener('focusout', (event) => {
    if (event.target.matches?.('[data-live]')) history.commitTransaction?.();
    const next = event.relatedTarget;
    if (pendingRender && !(next && typeof host.contains === 'function' && host.contains(next))) { pendingRender = false; renderCurrent({ force: true }); }
  });

  /** Live fields: preview on every tick without rebuilding the panel. */
  host.addEventListener('input', (event) => {
    const target = event.target;
    if (!target.matches?.('[data-live]')) return;
    const selected = selectedElement(); if (!selected) return;
    const property = target.dataset.appearance;
    if (!property) return;
    canvas.setAppearance(selected.id, property, target.value);
    // The other half of the pair follows: the text field beside a colour, the
    // readout beside a slider.
    const twin = host.querySelector(`input[type=text][data-appearance="${property}"]`);
    if (twin && twin !== target) twin.value = target.value;
    const output = host.querySelector(`[data-appearance-output="${property}"]`);
    if (output) output.value = `${Math.round(Number(target.value) * 100)}%`;
  });

  /** Everything else commits when the author is done with the field. */
  host.addEventListener('change', (event) => {
    const target = event.target;
    const selected = selectedElement();
    if (!selected) return;
    const { id, element, document } = selected;

    if (target.dataset.appearanceNone !== undefined) {
      const property = target.dataset.appearanceNone;
      if (target.checked) canvas.setAppearance(id, property, 'none');
      else {
        const picker = host.querySelector(`input[type=color][data-appearance="${property}"]`);
        canvas.setAppearance(id, property, picker?.value || (property === 'fill' ? '#60a5fa' : '#111827'));
      }
      renderCurrent({ force: true });
      return;
    }
    if (target.dataset.appearance) {
      if (target.matches('[data-live]')) return; // already written by the input handler
      canvas.setAppearance(id, target.dataset.appearance, target.value.trim());
      // A new stroke or a removed one changes which fields belong here.
      if (['stroke', 'fill'].includes(target.dataset.appearance)) renderCurrent({ force: true });
      return;
    }
    if (target.dataset.textContent !== undefined) { canvas.setTextContent?.(id, target.value); return; }

    if (target.dataset.transform) {
      const key = target.dataset.transform;
      commands.setTransform(id,{[key]:Number(target.value)});
      canvas.applyElementTransform(id, store.getDocument().elements[id]);
      return;
    }
    if (target.id === 'pivot-x' || target.id === 'pivot-y') {
      const px = Number(host.querySelector('#pivot-x')?.value || element.baseTransform?.pivotX || 0);
      const py = Number(host.querySelector('#pivot-y')?.value || element.baseTransform?.pivotY || 0);
      commands.setPivot(id,px,py);
      canvas.applyElementTransform(id, store.getDocument().elements[id]);
      return;
    }

    if (target.dataset.constraint) {
      const key = target.dataset.constraint;
      commands.updateElement(id,'set-constraints',item=>{item.constraints[key]=target.checked;});
      return;
    }
    if (target.dataset.bindingField) {
      const property = target.dataset.bindingProperty;
      const field = target.dataset.bindingField;
      commands.updateElement(id,'set-binding',(item,doc) => {
        item.bindings[property] ||= { enabled: true, expression: '0', curve: 'linear', amplitude: 1, offset: 0 };
        item.bindings[property][field] = field === 'enabled' ? target.checked : ['amplitude', 'offset'].includes(field) ? Number(target.value) : target.value;
        if (field === 'mode' && target.value === 'simple') item.bindings[property].expression = Object.keys(doc.params)[0] || '0';
      });
      if (field === 'mode') renderCurrent({ force: true });
      return;
    }
    if (target.id === 'symmetry-peer') {
      commands.updateElement(id,'set-symmetry',item=>{item.symmetryPeer=target.value||null;});
      return;
    }
    if (target.id === 'morph-enabled') {
      commands.updateElement(id,'set-morph',item=>{item.morph.enabled=target.checked;});
      return;
    }
    if (target.dataset.morph) {
      const key = target.dataset.morph;
      commands.updateElement(id,'set-morph',item => {
        item.morph[key] = key === 'param' || key.includes('path') ? target.value : Number(target.value);
      });
    }
    void document;
  });

  function tabHeader() {
    return `
      <div class="chip-row">
        <button class="chip ${activeTab === 'bindings' ? 'chip-active' : ''}" data-tab="bindings">Bindings</button>
        <button class="chip ${activeTab === 'morph' ? 'chip-active' : ''}" data-tab="morph">Morph</button>
        <button class="chip ${activeTab === 'presets' ? 'chip-active' : ''}" data-tab="presets">Presets</button>
      </div>
    `;
  }

  /**
   * Fill, stroke, opacity — and the geometry a shape can only have edited here.
   *
   * Values are read from the element itself, then from its computed style, and
   * never from svg.js's defaults: `attr('fill')` answers `#000000` for a shape
   * with no fill attribute, which is how an imported shape styled by CSS showed
   * a black swatch that changing appeared to do nothing about.
   */
  function appearanceSection(selectedId) {
    const wrapper=canvas.getNode(selectedId);
    const node=wrapper?.node;
    if(!node)return '<p class="small">Appearance is edited on the canvas artwork; select a piece that is drawn.</p>';
    const raw=(name)=>{const value=node.getAttribute?.(name);return value==null?null:String(value).trim();};
    const computed=(name)=>{try{return typeof getComputedStyle==='function'?String(getComputedStyle(node).getPropertyValue(name)||'').trim():'';}catch{return '';}};
    const paint=(name)=>raw(name)??computed(name)??'';
    const kind=node.localName||'';
    const isGroup=kind==='g';
    const paintRow=(name,label,value)=>{const none=!value||value==='none';const hex=paintToHex(value)||(name==='fill'?'#60a5fa':'#111827');return `<div class="paint-row" data-paint="${name}"><span class="paint-label">${label}</span><input type="color" data-appearance="${name}" data-live aria-label="${label} colour" value="${hex}"${none?' disabled':''}><input type="text" data-appearance="${name}" aria-label="${label} value" value="${escapeHtml(none?'none':value)}" spellcheck="false" title="A colour, a name, or url(#gradientId)"><label class="check paint-none"><input type="checkbox" data-appearance-none="${name}"${none?' checked':''}>None</label></div>`;};
    const number=(name,label,value,attrs='')=>`<label>${label}<input type="number" data-appearance="${name}" aria-label="${label}" value="${escapeHtml(value)}" ${attrs}></label>`;
    const choice=(name,label,options,current)=>`<label>${label}<select data-appearance="${name}" aria-label="${label}">${options.map(([value,text])=>`<option value="${value}"${current===value?' selected':''}>${text}</option>`).join('')}</select></label>`;
    const rows=[];
    const fill=paint('fill'), stroke=paint('stroke');
    if(!isGroup){
      rows.push(paintRow('fill','Fill',fill));
      if(fill&&fill!=='none')rows.push(number('fill-opacity','Fill opacity',raw('fill-opacity')??'1','min="0" max="1" step="0.05"'));
    }
    rows.push(paintRow('stroke','Stroke',stroke));
    if(stroke&&stroke!=='none'){
      rows.push(number('stroke-width','Stroke width',raw('stroke-width')??(computed('stroke-width').replace('px','')||'1'),'min="0" step="0.5"'));
      rows.push(number('stroke-opacity','Stroke opacity',raw('stroke-opacity')??'1','min="0" max="1" step="0.05"'));
      rows.push(choice('stroke-linecap','Line ends',[['butt','Flat'],['round','Round'],['square','Square']],raw('stroke-linecap')||'butt'));
      rows.push(choice('stroke-linejoin','Corners',[['miter','Sharp'],['round','Round'],['bevel','Bevel']],raw('stroke-linejoin')||'miter'));
      rows.push(`<label>Dashes<input type="text" data-appearance="stroke-dasharray" aria-label="Dash pattern" placeholder="e.g. 4 2 · empty for a solid line" value="${escapeHtml(raw('stroke-dasharray')||'')}"></label>`);
    }
    const opacity=raw('opacity')??'1';
    rows.push(`<label>Opacity <output data-appearance-output="opacity">${Math.round(Number(opacity)*100)}%</output><input type="range" data-appearance="opacity" data-live aria-label="Opacity" min="0" max="1" step="0.01" value="${escapeHtml(opacity)}"></label>`);
    const geometry=geometryFields(kind);
    if(geometry.length||kind==='text'){
      rows.push(`<h4>${kind==='text'?'Text':'Shape'}</h4>`);
      if(kind==='text')rows.push(`<label>Text<input type="text" data-text-content aria-label="Text content" value="${escapeHtml(node.textContent||'')}"></label>`);
      for(const [name,label,attrs] of geometry)rows.push(number(name,label,raw(name)??(name==='font-size'?'16':'0'),attrs));
      if(kind==='text')rows.push(choice('text-anchor','Anchor',[['start','Start'],['middle','Middle'],['end','End']],raw('text-anchor')||'start'));
      // Everything that reshapes artwork — the Node tool, a pin, a shape key, a
      // warp — works on a path's points, and a rectangle has none.
      if(kind!=='text')rows.push(`<button type="button" class="secondary" data-convert-path title="The same outline as a path: it can then be reshaped point by point, pinned, warped and given shape keys">Convert to a path</button>`);
    }
    return rows.join('');
  }

  function transformSection(element) {
    const transform = element.baseTransform || element;
    return `
      <label>X<input type="number" step="0.5" data-transform="x" value="${transform.x ?? 0}" /></label>
      <label>Y<input type="number" step="0.5" data-transform="y" value="${transform.y ?? 0}" /></label>
      <label>Pivot X<input id="pivot-x" type="number" step="0.5" value="${transform.pivotX || 0}" /></label>
      <label>Pivot Y<input id="pivot-y" type="number" step="0.5" value="${transform.pivotY || 0}" /></label>
      <label>Rotate<input type="number" step="0.5" data-transform="rotation" value="${transform.rotation || 0}" /></label>
      <label>Scale X<input type="number" step="0.1" data-transform="scaleX" value="${transform.scaleX || 1}" /></label>
      <label>Scale Y<input type="number" step="0.1" data-transform="scaleY" value="${transform.scaleY || 1}" /></label>
    `;
  }

  function bindingsSection(element, params) {
    return `
      <h4>Bindings</h4>
      ${['translateX', 'translateY', 'rotation', 'scaleX', 'scaleY', 'opacity'].map((property) => {
        const binding = typeof element.bindings?.[property] === 'object' ? element.bindings[property] : { enabled: false, expression: element.bindings?.[property] || '0', curve: 'linear', amplitude: 1, offset: 0 };
        const mode = binding.mode === 'simple' ? 'simple' : 'advanced';
        return `<details data-keep-open="binding-${property}"${sections.attr(`binding-${property}`)}><summary>${property}</summary>
          <label><input type="checkbox" data-binding-property="${property}" data-binding-field="enabled" ${binding.enabled ? 'checked' : ''}/> Enabled</label>
          <label>Mode<select data-binding-property="${property}" data-binding-field="mode"><option value="simple" ${mode === 'simple' ? 'selected' : ''}>Simple</option><option value="advanced" ${mode === 'advanced' ? 'selected' : ''}>Advanced</option></select></label>
          ${mode === 'simple' ? `<label>Parameter<select data-binding-property="${property}" data-binding-field="expression">${Object.keys(params || {}).map((name) => `<option value="${escapeHtml(name)}" ${binding.expression === name ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label>` : `<label>Expression<input data-binding-property="${property}" data-binding-field="expression" value="${escapeHtml(binding.expression)}" /></label>`}
          <label>Curve<select data-binding-property="${property}" data-binding-field="curve"><option ${binding.curve === 'linear' ? 'selected' : ''}>linear</option><option ${binding.curve === 'easeInOut' ? 'selected' : ''}>easeInOut</option></select></label>
          <label>Amplitude<input type="number" step="0.1" data-binding-property="${property}" data-binding-field="amplitude" value="${binding.amplitude}" /></label>
          <label>Offset<input type="number" step="0.1" data-binding-property="${property}" data-binding-field="offset" value="${binding.offset}" /></label>
        </details>`;
      }).join('')}

      <h4>Symmetry</h4>
      <label>Symmetry peer id<input id="symmetry-peer" value="${escapeHtml(element.symmetryPeer || '')}" placeholder="eyeRight"/></label>
      <button id="mirror-apply">Mirror selected to peer</button>
      <p class="small">Mirrors across the middle of the working area.</p>
    `;
  }

  function morphSection(element, params) {
    return `
      <h4>Morph (legacy)</h4>
      <label><input id="morph-enabled" type="checkbox" ${element.morph?.enabled ? 'checked' : ''}/> Enable morph</label>
      <label>Morph param<select data-morph="param">
        ${Object.keys(params || {}).map((name) => `<option value="${escapeHtml(name)}" ${element.morph?.param === name ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}
      </select></label>
      <label>Min<input data-morph="min" type="number" step="0.1" value="${element.morph?.min ?? -1}" /></label>
      <label>Max<input data-morph="max" type="number" step="0.1" value="${element.morph?.max ?? 1}" /></label>
      <label>Path A<textarea data-morph="pathA">${escapeHtml(element.morph?.pathA || '')}</textarea></label>
      <label>Path B<textarea data-morph="pathB">${escapeHtml(element.morph?.pathB || '')}</textarea></label>
    `;
  }

  function presetSection(selectedId) {
    const suggested = suggestPresetForElement(selectedId);
    return `
      <h4>Animation presets by part</h4>
      <label>Suggested preset (${escapeHtml(suggested)})<select id="part-preset-select">
        ${Object.entries(PART_PRESETS).map(([key, preset]) => `<option value="${key}" ${key === suggested ? 'selected' : ''}>${escapeHtml(preset.label)}</option>`).join('')}
      </select></label>
      <button id="apply-part-preset">Apply preset to selected part</button>
      <p class="small">Quickly applies the bindings, constraints and morph options that suit the selected piece of SVG.</p>
    `;
  }

  function constraintsSection(element) {
    return `<h4>Constraints</h4><label><input type="checkbox" data-constraint="translate" ${element.constraints?.translate?'checked':''}/> Translate</label><label><input type="checkbox" data-constraint="rotate" ${element.constraints?.rotate?'checked':''}/> Rotate</label><label><input type="checkbox" data-constraint="scale" ${element.constraints?.scale?'checked':''}/> Scale</label>`;
  }

  function renderCurrent({ force = false } = {}) {
    if (!force && hasFocusInside()) { pendingRender = true; return; }
    pendingRender = false;
    const state=store.getDocument(), selectedId=store.getSession().selectedId;
    if (!selectedId) { host.innerHTML = '<p>Select an element on the canvas or in Layers.</p>'; return; }
    const selectedIds = store.getSession().selectedIds || [];
    if (selectedIds.length > 1) {
      const nameOf = (id) => state.layerMetadata?.[id]?.name || canvas.getNode?.(id)?.node?.getAttribute?.('data-name') || id;
      host.innerHTML = `<section class="inspector-multi" data-multi-selection="${selectedIds.length}"><h3>${selectedIds.length} pieces selected</h3><ul>${selectedIds.map((id) => `<li>${escapeHtml(nameOf(id))}</li>`).join('')}</ul><p class="small">Drag any of them to move them all. Align, Spread and Group are in the bar above the canvas; the arrow keys nudge them and Delete removes them. Click one piece to edit it on its own.</p></section>`;
      return;
    }
    // Something *is* selected: saying "select something" here was the panel
    // contradicting the heading above it.
    if (!state.elements[selectedId]) { host.innerHTML = `<p>“${escapeHtml(state.layerMetadata?.[selectedId]?.name || selectedId)}” is selected, but it carries no editable artwork data.</p>`; return; }
    const element=state.elements[selectedId], subject=inspectorSubject(state, selectedId);
    // "Nose · Nose" said the same thing twice: the role is only worth naming
    // when it is not already the part's name.
    const role = subject.role && roleWords(subject.role) !== subject.part ? ` · ${escapeHtml(roleWords(subject.role))}` : '';
    setPanelHtml(host, `<div class="layer-item active"><strong>${escapeHtml(subject.name)}</strong> ${subject.part ? `<span class="semantic-badge">${escapeHtml(subject.part)}${role}</span>` : '<span class="small">No face part uses this piece</span>'}</div><section aria-labelledby="transform-heading"><h3 id="transform-heading">Transform</h3>${transformSection(element)}</section><section class="appearance-section" aria-labelledby="appearance-heading"><h3 id="appearance-heading">Appearance</h3>${appearanceSection(selectedId)}</section><details class="advanced-inspector" data-keep-open="advanced"${sections.attr('advanced')}><summary>Advanced</summary>${constraintsSection(element)}${tabHeader()}<div data-advanced-content>${activeTab==='bindings'?bindingsSection(element,state.params):activeTab==='morph'?morphSection(element,state.params):activeTab==='presets'?presetSection(selectedId):bindingsSection(element,state.params)}</div><details data-keep-open="identity"${sections.attr('identity')}><summary>Technical identity</summary><p class="small">SVG ID: ${escapeHtml(selectedId)}</p></details></details>`);
  }

  return {
    render: () => renderCurrent(),
    /**
     * Open the Advanced disclosure on one tab.
     *
     * Advanced tools promises "Bindings · Constraints · Morphs"; before this it
     * selected the element and stopped, leaving the editor it named closed.
     */
    openAdvanced(tab = 'bindings') {
      activeTab = ['bindings', 'morph', 'presets'].includes(tab) ? tab : 'bindings';
      renderCurrent({ force: true });
      const details = host.querySelector('.advanced-inspector');
      if (details) details.open = true;
      return activeTab;
    }
  };
}
