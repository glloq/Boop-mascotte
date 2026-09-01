import { setPivot } from '../rig-editor/rig-store.js';
import { mirrorTransformX } from '../core/rig/symmetry.js';
import { PART_PRESETS, suggestPresetForElement } from '../core/assets/part-presets.js';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function createInspector(host, store, history, canvas) {
  let activeTab = 'transform';

  host.addEventListener('click', (event) => {
    const tab = event.target.dataset.tab;
    if (tab) {
      activeTab = tab;
      renderCurrent();
      return;
    }


    if (event.target.id === 'apply-part-preset') {
      const state = store.getState();
      const id = state.selectedId;
      if (!id || !state.elements[id]) return;
      const presetId = host.querySelector('#part-preset-select')?.value;
      const preset = PART_PRESETS[presetId];
      if (!preset) return;
      history.snapshot();
      store.setState((draft) => {
        preset.apply(draft.elements[id]);
      });
      canvas.applyElementTransform(id, store.getState().elements[id]);
      renderCurrent();
      return;
    }
    if (event.target.id !== 'mirror-apply') return;
    const state = store.getState();
    const id = state.selectedId;
    if (!id) return;
    const src = state.elements[id];
    const peerId = src?.symmetryPeer;
    if (!peerId || !state.elements[peerId]) return;

    history.snapshot();
    const mirrored = mirrorTransformX(src);
    store.setState((draft) => {
      draft.elements[peerId] = { ...draft.elements[peerId], ...mirrored };
    });
    canvas.applyElementTransform(peerId, store.getState().elements[peerId]);
  });

  host.addEventListener('input', (event) => {
    const state = store.getState();
    const id = state.selectedId;
    if (!id) return;
    const element = state.elements[id];
    if (!element) return;

    if (event.target.dataset.appearance) {
      canvas.setAppearance(id, event.target.dataset.appearance, event.target.value);
      return;
    }

    if (event.target.dataset.transform) {
      const key = event.target.dataset.transform;
      history.snapshot();
      store.setState((draft) => { draft.elements[id].baseTransform[key] = Number(event.target.value); });
      canvas.applyElementTransform(id, store.getState().elements[id]);
    }

    if (event.target.dataset.constraint) {
      const key = event.target.dataset.constraint;
      history.snapshot();
      store.setState((draft) => { draft.elements[id].constraints[key] = event.target.checked; });
    }

    if (event.target.dataset.bindingField) {
      const property = event.target.dataset.bindingProperty;
      const field = event.target.dataset.bindingField;
      history.snapshot();
      store.setState((draft) => {
        draft.elements[id].bindings[property] ||= { enabled: true, expression: '0', curve: 'linear', amplitude: 1, offset: 0 };
        draft.elements[id].bindings[property][field] = field === 'enabled' ? event.target.checked : ['amplitude', 'offset'].includes(field) ? Number(event.target.value) : event.target.value;
        if (field === 'mode' && event.target.value === 'simple') draft.elements[id].bindings[property].expression = Object.keys(draft.params)[0] || '0';
      });
      if (field === 'mode') renderCurrent();
    }

    if (event.target.id === 'symmetry-peer') {
      history.snapshot();
      store.setState((draft) => { draft.elements[id].symmetryPeer = event.target.value || null; });
    }

    if (event.target.id === 'morph-enabled') {
      history.snapshot();
      store.setState((draft) => { draft.elements[id].morph.enabled = event.target.checked; });
    }

    if (event.target.dataset.morph) {
      const key = event.target.dataset.morph;
      history.snapshot();
      store.setState((draft) => {
        draft.elements[id].morph[key] = key === 'param' || key.includes('path') ? event.target.value : Number(event.target.value);
      });
    }

    if (event.target.id === 'pivot-x' || event.target.id === 'pivot-y') {
      const px = Number(host.querySelector('#pivot-x')?.value || element.baseTransform?.pivotX || 0);
      const py = Number(host.querySelector('#pivot-y')?.value || element.baseTransform?.pivotY || 0);
      history.snapshot();
      setPivot(store, id, px, py);
      canvas.applyElementTransform(id, store.getState().elements[id]);
    }
  });

  function tabHeader() {
    return `
      <div class="chip-row">
        <button class="chip ${activeTab === 'transform' ? 'chip-active' : ''}" data-tab="transform">Transform</button>
        <button class="chip ${activeTab === 'appearance' ? 'chip-active' : ''}" data-tab="appearance">Appearance</button>
        <button class="chip ${activeTab === 'bindings' ? 'chip-active' : ''}" data-tab="bindings">Bindings</button>
        <button class="chip ${activeTab === 'morph' ? 'chip-active' : ''}" data-tab="morph">Morph</button>
        <button class="chip ${activeTab === 'presets' ? 'chip-active' : ''}" data-tab="presets">Presets</button>
      </div>
    `;
  }

  function appearanceSection(selectedId) {
    const node=canvas.getNode(selectedId);
    const attr=(name,fallback='')=>escapeHtml(node?.attr(name)??fallback);
    return `<h4>Appearance</h4>
      <label>Fill</label><div class="inline"><input type="color" data-appearance="fill" value="${/^#[0-9a-f]{6}$/i.test(attr('fill'))?attr('fill'):'#60a5fa'}"><input data-appearance="fill" value="${attr('fill','none')}" aria-label="Fill value"></div>
      <label>Stroke</label><div class="inline"><input type="color" data-appearance="stroke" value="${/^#[0-9a-f]{6}$/i.test(attr('stroke'))?attr('stroke'):'#111827'}"><input data-appearance="stroke" value="${attr('stroke','none')}" aria-label="Stroke value"></div>
      <label>Stroke width</label><input type="number" min="0" step="0.5" data-appearance="stroke-width" value="${attr('stroke-width','0')}">
      <label>Opacity</label><input type="range" min="0" max="1" step="0.01" data-appearance="opacity" value="${attr('opacity','1')}">`;
  }

  function transformSection(element) {
    const transform = element.baseTransform || element;
    return `
      <label>X</label>
      <input type="number" data-transform="x" value="${transform.x ?? 0}" />
      <label>Y</label>
      <input type="number" data-transform="y" value="${transform.y ?? 0}" />
      <label>Pivot X</label>
      <input id="pivot-x" type="number" value="${transform.pivotX || 0}" />
      <label>Pivot Y</label>
      <input id="pivot-y" type="number" value="${transform.pivotY || 0}" />
      <label>Rotate</label>
      <input type="number" data-transform="rotation" value="${transform.rotation || 0}" />
      <label>Scale X</label>
      <input type="number" step="0.1" data-transform="scaleX" value="${transform.scaleX || 1}" />
      <label>Scale Y</label>
      <input type="number" step="0.1" data-transform="scaleY" value="${transform.scaleY || 1}" />

      <h4>Constraints</h4>
      <label><input type="checkbox" data-constraint="translate" ${element.constraints?.translate ? 'checked' : ''}/> Translate</label>
      <label><input type="checkbox" data-constraint="rotate" ${element.constraints?.rotate ? 'checked' : ''}/> Rotate</label>
      <label><input type="checkbox" data-constraint="scale" ${element.constraints?.scale ? 'checked' : ''}/> Scale</label>
    `;
  }

  function bindingsSection(element, params) {
    return `
      <h4>Bindings</h4>
      ${['translateX', 'translateY', 'rotation', 'scaleX', 'scaleY', 'opacity'].map((property) => {
        const binding = typeof element.bindings?.[property] === 'object' ? element.bindings[property] : { enabled: false, expression: element.bindings?.[property] || '0', curve: 'linear', amplitude: 1, offset: 0 };
        const mode = binding.mode === 'simple' ? 'simple' : 'advanced';
        return `<details><summary>${property}</summary>
          <label><input type="checkbox" data-binding-property="${property}" data-binding-field="enabled" ${binding.enabled ? 'checked' : ''}/> Enabled</label>
          <label>Mode</label><select data-binding-property="${property}" data-binding-field="mode"><option value="simple" ${mode === 'simple' ? 'selected' : ''}>Simple</option><option value="advanced" ${mode === 'advanced' ? 'selected' : ''}>Advanced</option></select>
          ${mode === 'simple' ? `<label>Parameter</label><select data-binding-property="${property}" data-binding-field="expression">${Object.keys(params || {}).map((name) => `<option value="${escapeHtml(name)}" ${binding.expression === name ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select>` : `<label>Expression</label><input data-binding-property="${property}" data-binding-field="expression" value="${escapeHtml(binding.expression)}" />`}
          <label>Curve</label><select data-binding-property="${property}" data-binding-field="curve"><option ${binding.curve === 'linear' ? 'selected' : ''}>linear</option><option ${binding.curve === 'easeInOut' ? 'selected' : ''}>easeInOut</option></select>
          <label>Amplitude</label><input type="number" step="0.1" data-binding-property="${property}" data-binding-field="amplitude" value="${binding.amplitude}" />
          <label>Offset</label><input type="number" step="0.1" data-binding-property="${property}" data-binding-field="offset" value="${binding.offset}" />
        </details>`;
      }).join('')}

      <h4>Symmetry</h4>
      <label>Symmetry peer id</label>
      <input id="symmetry-peer" value="${escapeHtml(element.symmetryPeer || '')}" placeholder="eyeRight"/>
      <button id="mirror-apply">Mirror selected to peer</button>
    `;
  }

  function morphSection(element, params) {
    return `
      <h4>Morph (Phase 2)</h4>
      <label><input id="morph-enabled" type="checkbox" ${element.morph?.enabled ? 'checked' : ''}/> Enable morph</label>
      <label>Morph param</label>
      <select data-morph="param">
        ${Object.keys(params || {}).map((name) => `<option value="${escapeHtml(name)}" ${element.morph?.param === name ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}
      </select>
      <label>Min</label>
      <input data-morph="min" type="number" step="0.1" value="${element.morph?.min ?? -1}" />
      <label>Max</label>
      <input data-morph="max" type="number" step="0.1" value="${element.morph?.max ?? 1}" />
      <label>Path A</label>
      <textarea data-morph="pathA">${escapeHtml(element.morph?.pathA || '')}</textarea>
      <label>Path B</label>
      <textarea data-morph="pathB">${escapeHtml(element.morph?.pathB || '')}</textarea>
    `;
  }


  function presetSection(selectedId) {
    const suggested = suggestPresetForElement(selectedId);
    return `
      <h4>Animation presets par partie</h4>
      <label>Preset conseillé (${suggested})</label>
      <select id="part-preset-select">
        ${Object.entries(PART_PRESETS).map(([key, preset]) => `<option value="${key}" ${key === suggested ? 'selected' : ''}>${preset.label}</option>`).join('')}
      </select>
      <button id="apply-part-preset">Apply preset to selected part</button>
      <p class="small">Applique rapidement bindings, contraintes et options morph adaptées à la partie SVG sélectionnée.</p>
    `;
  }

  function renderCurrent() {
    const state = store.getState();
    const selectedId = state.selectedId;
    if (!selectedId) {
      host.innerHTML = `<h3>Inspector</h3><p>Select an element to edit rig details.</p>`;
      return;
    }
    const element = state.elements[selectedId];
    const body = activeTab === 'transform' ? transformSection(element) : activeTab === 'appearance' ? appearanceSection(selectedId) : activeTab === 'bindings' ? bindingsSection(element, state.params) : activeTab === 'morph' ? morphSection(element, state.params) : presetSection(selectedId);
    host.innerHTML = `
      <h3>Inspector</h3>
      <div class="layer-item active">${escapeHtml(selectedId)}</div>
      ${tabHeader()}
      ${body}
    `;
  }

  return { render: renderCurrent };
}
