export function createAppShell(root) {
  root.innerHTML = `
    <section class="panel" id="left"></section>
    <section id="canvas"></section>
    <section class="panel-right" id="inspector"></section>
  `;

  const leftSidebarEl = root.querySelector('#left');
  const canvasEl = root.querySelector('#canvas');
  const inspectorEl = root.querySelector('#inspector');

  leftSidebarEl.innerHTML = `
    <h2>SVG Mascot Rig Editor</h2>
    <div class="toolbar">
      <input type="file" id="svg-file" accept=".svg" />
      <button id="load-sample">Load Sample</button>
      <button id="undo">Undo</button>
      <button id="redo">Redo</button>
    </div>
    <label>Preset library</label>
    <select id="preset-select">
      <option value="classic">Classic Mascot</option>
      <option value="chill">Chill Mascot</option>
    </select>
    <button id="apply-preset">Apply preset</button>
    <div id="status" class="small"></div>
    <div id="plugin-status" class="small"></div>
    <hr />
    <div id="state-editor"></div>
    <hr />
    <div id="preview-panel"></div>
    <hr />
    <div class="export" id="export-panel"></div>
  `;

  return {
    leftSidebarEl,
    canvasEl,
    inspectorEl,
    setStatus(message, tone = 'info') {
      const el = leftSidebarEl.querySelector('#status');
      el.textContent = message;
      el.style.color = tone === 'error' ? '#fca5a5' : tone === 'warn' ? '#fbbf24' : '#9ca3af';
    },
    setPluginStatus(message) {
      leftSidebarEl.querySelector('#plugin-status').textContent = message;
    },
    bindLoadSvg(handler) {
      leftSidebarEl.querySelector('#svg-file').addEventListener('change', (event) => {
        const [file] = event.target.files || [];
        if (file) handler(file);
      });
    },
    bindLoadSample(handler) {
      leftSidebarEl.querySelector('#load-sample').addEventListener('click', handler);
    },
    bindApplyPreset(handler) {
      leftSidebarEl.querySelector('#apply-preset').addEventListener('click', () => {
        const id = leftSidebarEl.querySelector('#preset-select').value;
        handler(id);
      });
    },
    bindUndoRedo(undo, redo) {
      leftSidebarEl.querySelector('#undo').addEventListener('click', undo);
      leftSidebarEl.querySelector('#redo').addEventListener('click', redo);
    }
  };
}
