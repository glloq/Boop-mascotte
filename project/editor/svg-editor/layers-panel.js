export function createLayersPanel(leftSidebarEl, store) {
  const host = document.createElement('div');
  host.id = 'layers-panel';
  leftSidebarEl.appendChild(document.createElement('hr'));
  leftSidebarEl.appendChild(host);

  host.addEventListener('click', (event) => {
    const { action, id } = event.target.dataset;
    if (!id) return;

    if (action === 'select') {
      store.setState((state) => {
        state.selectedId = id;
      });
      return;
    }

    if (action === 'up' || action === 'down') {
      store.setState((state) => {
        const idx = state.layers.indexOf(id);
        if (idx < 0) return;
        const swap = action === 'up' ? idx - 1 : idx + 1;
        if (swap < 0 || swap >= state.layers.length) return;
        [state.layers[idx], state.layers[swap]] = [state.layers[swap], state.layers[idx]];
      });
    }
  });

  host.addEventListener('input', (event) => {
    if (event.target.id !== 'layer-filter') return;
    render(event.target.value.trim().toLowerCase());
  });

  function render(filter = '') {
    const state = store.getState();
    const visibleLayers = state.layers.filter((id) => id.toLowerCase().includes(filter));
    host.innerHTML = `
      <h3>Layers <span class="small">(${visibleLayers.length}/${state.layers.length})</span></h3>
      <input id="layer-filter" placeholder="Filter layers..." value="${filter}" />
      ${visibleLayers.map((id, i) => `
        <div class="layer-item ${state.selectedId === id ? 'active' : ''}">
          <span data-action="select" data-id="${id}">${i + 1}. ${id}</span>
          <div style="float:right;display:flex;gap:4px;">
            <button data-action="up" data-id="${id}" title="Move up">↑</button>
            <button data-action="down" data-id="${id}" title="Move down">↓</button>
          </div>
        </div>
      `).join('') || '<p class="small">No layers match filter.</p>'}
    `;
  }

  return { render };
}
