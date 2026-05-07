export function buildToolbar() {
  return `
    <div class="toolbar">
      <input type="file" id="svg-file" accept=".svg" />
<<<<<<< codex/initialize-svg-mascot-rig-editor-project-n93ut8
      <input type="file" id="rig-file" accept=".json" />
      <button id="load-sample">Load Sample</button>
      <button id="undo">Undo</button>
      <button id="redo">Redo</button>
      <button id="save-project">Save Project</button>
      <input type="file" id="project-file" accept=".json" />
      <button id="restore-autosave">Restore Autosave</button>
=======
      <button id="load-sample">Load Sample</button>
      <button id="undo">Undo</button>
      <button id="redo">Redo</button>
>>>>>>> main
    </div>
  `;
}

export function buildPresetSection() {
  return `
    <label>Preset library</label>
    <select id="preset-select">
      <option value="classic">Classic Mascot</option>
      <option value="chill">Chill Mascot</option>
    </select>
    <button id="apply-preset">Apply preset</button>
  `;
}

export function buildPluginSection() {
  return `
    <details open>
      <summary>Plugin manager</summary>
      <label><input id="plugin-path" type="checkbox" checked /> Enable path plugin</label>
      <div id="plugin-status" class="small"></div>
    </details>
  `;
}

export function buildShortcutSection() {
  return `
    <details>
      <summary>Keyboard shortcuts</summary>
      <div class="small">Ctrl/Cmd+Z: Undo • Ctrl/Cmd+Y: Redo • 1/2/3: idle/happy/sad</div>
    </details>
  `;
}
<<<<<<< codex/initialize-svg-mascot-rig-editor-project-n93ut8

export function buildFaceBuilderSection() {
  return `
    <details open>
      <summary>Face Builder</summary>
      <label>Head</label>
      <select id="face-head"><option value="circle">Circle</option><option value="square">Rounded square</option></select>
      <label>Eyes</label>
      <select id="face-eyes"><option value="oval">Oval</option><option value="dot">Dot</option></select>
      <label>Mouth</label>
      <select id="face-mouth"><option value="smile">Smile</option><option value="flat">Flat</option><option value="sad">Sad</option></select>
      <button id="generate-face">Generate face</button>
    </details>
  `;
}
=======
>>>>>>> main
