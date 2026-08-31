import runtimeSource from '../../../runtime/runtime.js?raw';

export function createExporter(leftSidebarEl, store) {
  const host = leftSidebarEl.querySelector('#export-panel');

  host.addEventListener('click', (event) => {
    if (event.target.id !== 'export-btn') return;
    const state = store.getState();

    download('mascot.svg', state.svgMarkup || '<svg />');
    download('rig.json', JSON.stringify({
      params: state.params,
      states: state.states,
      elements: state.elements,
      activeState: state.activeState,
      transitions: state.transitions,
      globalConstraints: state.globalConstraints,
      stateConstraints: state.stateConstraints,
      runtimeConfig: state.runtimeConfig
    }, null, 2));
    download('runtime.js', runtimeSource);
  });

  return {
    render() {
      host.innerHTML = `
        <h3>Export</h3>
        <button id="export-btn">Export mascot.svg + rig.json + runtime.js</button>
      `;
    }
  };
}

function download(name, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}
