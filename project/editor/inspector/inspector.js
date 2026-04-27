import { setPivot } from '../rig-editor/rig-store.js';
import { mirrorTransformX } from '../core/rig/symmetry.js';

export function createInspector(host, store, history, canvas) {
  host.addEventListener('input', (event) => {
    const state = store.getState();
    const id = state.selectedId;
    if (!id) return;
    const element = state.elements[id];
    if (!element) return;

    if (event.target.dataset.transform) {
      const key = event.target.dataset.transform;
      const value = Number(event.target.value);
      history.snapshot();
      store.setState((draft) => {
        draft.elements[id][key] = value;
      });
      canvas.applyElementTransform(id, store.getState().elements[id]);
    }

    if (event.target.dataset.constraint) {
      const key = event.target.dataset.constraint;
      history.snapshot();
      store.setState((draft) => {
        draft.elements[id].constraints[key] = event.target.checked;
      });
    }

    if (event.target.id === 'binding-translate-x') {
      history.snapshot();
      store.setState((draft) => {
        draft.elements[id].bindings.translateX = event.target.value;
      });
    }

    if (event.target.id === 'curve-translate-x') {
      history.snapshot();
      store.setState((draft) => {
        draft.elements[id].bindingCurves.translateX = event.target.value;
      });
    }

    if (event.target.id === 'symmetry-peer') {
      history.snapshot();
      store.setState((draft) => {
        draft.elements[id].symmetryPeer = event.target.value || null;
      });
    }

    if (event.target.id === 'pivot-x' || event.target.id === 'pivot-y') {
      const px = Number(host.querySelector('#pivot-x')?.value || element.pivotX || 0);
      const py = Number(host.querySelector('#pivot-y')?.value || element.pivotY || 0);
      history.snapshot();
      setPivot(store, id, px, py);
      canvas.applyElementTransform(id, store.getState().elements[id]);
    }
  });

  host.addEventListener('click', (event) => {
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

  return {
    render() {
      const state = store.getState();
      const selectedId = state.selectedId;
      if (!selectedId) {
        host.innerHTML = `<h3>Inspector</h3><p>Select an element to edit pivot, constraints, bindings, and symmetry.</p>`;
        return;
      }

      const element = state.elements[selectedId];
      host.innerHTML = `
        <h3>Inspector</h3>
        <div class="layer-item active">${selectedId}</div>
        <label>Pivot X</label>
        <input id="pivot-x" type="number" value="${element.pivotX || 0}" />
        <label>Pivot Y</label>
        <input id="pivot-y" type="number" value="${element.pivotY || 0}" />
        <label>Rotate</label>
        <input type="number" data-transform="rotation" value="${element.rotation || 0}" />
        <label>Scale X</label>
        <input type="number" step="0.1" data-transform="scaleX" value="${element.scaleX || 1}" />
        <label>Scale Y</label>
        <input type="number" step="0.1" data-transform="scaleY" value="${element.scaleY || 1}" />

        <h4>Constraints</h4>
        <label><input type="checkbox" data-constraint="translate" ${element.constraints?.translate ? 'checked' : ''}/> Translate</label>
        <label><input type="checkbox" data-constraint="rotate" ${element.constraints?.rotate ? 'checked' : ''}/> Rotate</label>
        <label><input type="checkbox" data-constraint="scale" ${element.constraints?.scale ? 'checked' : ''}/> Scale</label>

        <h4>Bindings</h4>
        <label>translateX expression</label>
        <textarea id="binding-translate-x">${element.bindings?.translateX || 'headX * 2'}</textarea>
        <label>translateX curve</label>
        <select id="curve-translate-x">
          <option value="linear" ${element.bindingCurves?.translateX === 'linear' ? 'selected' : ''}>linear</option>
          <option value="easeInOut" ${element.bindingCurves?.translateX === 'easeInOut' ? 'selected' : ''}>easeInOut</option>
        </select>

        <h4>Symmetry</h4>
        <label>Symmetry peer id</label>
        <input id="symmetry-peer" value="${element.symmetryPeer || ''}" placeholder="eyeRight"/>
        <button id="mirror-apply">Mirror selected to peer</button>
      `;
    }
  };
}
