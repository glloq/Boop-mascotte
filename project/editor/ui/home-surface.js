// One template. Three starter faces meant three sets of artwork to keep rigged,
// and the two extra ones were strictly smaller than this one.
const TEMPLATES = [
  { id: 'basic', title: 'Mascot Face', description: 'A complete cartoon face, rigged and ready', capabilities: 'Head turn in 2.5D, eyes, gaze, eyelids, brows, nose, ears, hair and mouth', recommended: true },
  // From scratch: the same working area with nothing on it, for the shape tools.
  { id: 'blank', title: 'Blank canvas', description: 'An empty working area to draw your own', capabilities: 'Pen, line, rectangle, ellipse, polygon and text tools; rig what you draw in Face Setup', recommended: false }
];

/**
 * Building a face from parts is a way to *start* a mascot, so it starts one
 * here, beside the other two.
 *
 * It used to live at the end of a path nobody walks: Artwork → Add / Create
 * artwork → More templates and tools → Face Builder — three disclosures deep,
 * inside the panel for adding to the artwork you already have, and pressing it
 * replaced the whole project.
 */
const FACE_BUILDER_FIELDS = [
  { id: 'face-head', label: 'Head', options: [['circle', 'Circle'], ['square', 'Rounded square']] },
  { id: 'face-eyes', label: 'Eyes', options: [['oval', 'Oval'], ['dot', 'Dot']] },
  { id: 'face-mouth', label: 'Mouth', options: [['smile', 'Smile'], ['flat', 'Flat'], ['sad', 'Sad']] }
];

const faceBuilderCard = () => `<button class="home-card" data-home-action="builder" aria-expanded="false" aria-controls="face-builder"><span><b>Build a face</b></span><small>Pick a head, eyes and a mouth</small><small>Head, eyes, gaze, eyebrows and mouth, rigged from your choices</small></button>`;

const faceBuilderMarkup = () => `<div class="home-builder" id="face-builder" hidden role="group" aria-label="Build a face">${FACE_BUILDER_FIELDS.map((field) => `<label for="${field.id}">${field.label}</label><select id="${field.id}">${field.options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select>`).join('')}<button id="generate-face">Create mascot</button></div>`;

export function homeSurfaceMarkup() {
  return `<section class="home-surface" data-home aria-labelledby="home-heading" hidden><div class="home-panel">
    <p class="home-brand">BOOP Mascot Studio</p><h1 id="home-heading" tabindex="-1">Create or continue a mascot</h1>
    <section aria-labelledby="home-start"><h2 id="home-start">New Mascot</h2><div class="home-templates">${TEMPLATES.map(item=>`<button class="home-card ${item.recommended?'recommended':''}" data-template-id="${item.id}"><span><b>${item.title}</b>${item.recommended?'<em>Recommended</em>':''}</span><small>${item.description}</small><small>${item.capabilities}</small></button>`).join('')}${faceBuilderCard()}</div>${faceBuilderMarkup()}</section>
    <section aria-labelledby="home-open-heading"><h2 id="home-open-heading">Open Project</h2><label class="button secondary home-open" data-home-action="open">Open Project <small>Choose an editable mascot-project.json file</small><input hidden type="file" id="home-project-file" accept=".json,application/json"></label></section>
    <section aria-labelledby="home-import-heading"><h2 id="home-import-heading">Import Artwork</h2><label class="button secondary home-open" data-home-action="import-svg">Import SVG <small>Artwork only</small><input hidden type="file" id="home-svg-file" accept=".svg,image/svg+xml"></label></section>
    <section class="home-recovery" aria-labelledby="home-continue" data-recovery-status="none"><h2 id="home-continue">Continue</h2><div data-recovery-content></div><p class="small">Stored only in this browser. Not synced to the cloud.</p></section>
    <button class="secondary home-back" data-home-action="back" hidden>Back to current project</button>
  </div></section>`;
}

export function renderHomeRecovery(container, recovery) {
  container.dataset.recoveryStatus = recovery.status;
  const content = container.querySelector('[data-recovery-content]');
  if (recovery.status === 'available') {
    const when = recovery.savedAt ? ` Saved ${new Date(recovery.savedAt).toLocaleString()}.` : '';
    content.innerHTML = `<p>A local draft is available.${when}</p><button data-home-action="recover">Recover local draft</button>`;
  } else if (recovery.status === 'invalid') content.innerHTML = '<p role="alert">This local draft could not be read. Your current project was not changed.</p><button class="secondary" data-home-action="discard-recovery">Discard local draft</button>';
  else content.innerHTML = '<p>No local draft is available.</p>';
}
