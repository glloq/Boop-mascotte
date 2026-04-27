export function buildToolbar() {
  return `
    <div class="toolbar">
      <input type="file" id="svg-file" accept=".svg" />
      <input type="file" id="rig-file" accept=".json" />
      <button id="load-sample">Load Sample</button>
      <button id="undo">Undo</button>
      <button id="redo">Redo</button>
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
