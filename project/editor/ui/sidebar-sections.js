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

export function buildFaceBuilderSection() {
  return `
    <details open id="face-builder">
      <summary>Face Builder</summary>
      <div class="face-preview" aria-hidden="true"><span>●</span><span>●</span><b>⌣</b></div>
      <label>Head</label>
      <select id="face-head"><option value="circle">Circle</option><option value="square">Rounded square</option></select>
      <label>Eyes</label>
      <select id="face-eyes"><option value="oval">Oval</option><option value="dot">Dot</option></select>
      <label>Mouth</label>
      <select id="face-mouth"><option value="smile">Smile</option><option value="flat">Flat</option><option value="sad">Sad</option></select>
      <button id="generate-face">Create mascot</button>
    </details>
  `;
}
