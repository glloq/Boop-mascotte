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
      <button id="undo">Undo</button>
      <button id="redo">Redo</button>
    </div>
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
    bindLoadSvg(handler) {
      leftSidebarEl.querySelector('#svg-file').addEventListener('change', (event) => {
        const [file] = event.target.files || [];
        if (file) handler(file);
      });
    },
    bindUndoRedo(undo, redo) {
      leftSidebarEl.querySelector('#undo').addEventListener('click', undo);
      leftSidebarEl.querySelector('#redo').addEventListener('click', redo);
    }
  };
}
