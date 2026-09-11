/**
 * Home starts a mascot, and that is all it does (V3-08, docs/V3_ROADMAP.md).
 *
 * It used to be six things at once: two templates, a face builder with three
 * selects, an SVG import, a project file picker and the local draft. Five of
 * them are not "start a mascot" — they are "come back to work you already
 * have" or "keep working on the drawing in front of you" — and on a first run
 * they are the wrong five things to read. So Home offers the two ways to get a
 * mascot with nothing of your own to hand: a preset, or the mascot as it comes.
 *
 * Everything that left is still reachable from the topbar, which sits *above*
 * Home (z-index 90 against 80) and is therefore usable while Home is open:
 * Open Project and Import SVG in the ••• menu, and Blank canvas and the Face
 * Builder in Artwork, next to Start over with the Mascot Face.
 */

// One template. Three starter faces meant three sets of artwork to keep rigged,
// and the two extra ones were strictly smaller than this one. The table stays a
// table: `bindLoadSample` binds every `[data-template-id]` it finds, here and
// in Artwork, and neither place knows a template id.
const TEMPLATES = [
  { id: 'basic', title: 'Mascot Face', description: 'The mascot as it comes, rigged and ready', capabilities: 'Head turn in 2.5D, eyes, gaze, eyelids, brows, nose, ears, hair and mouth; lands in Artwork', recommended: false }
];

/**
 * The one-minute path (docs/CHARACTER_BUILDER.md, "The one-minute path"):
 * the same rigged template, landing in the Character Builder with the
 * presets open, so a character is a preset and a few swaps -- no rig step.
 */
const characterCard = () => `<button class="home-card recommended" data-home-action="character"><span><b>New Character</b><em>Recommended</em></span><small>A preset, then any part swapped for another style</small><small>Head, eyes, hair, mouth, glasses and hands from the library, rigged as they go; under a minute</small></button>`;

/**
 * Where the rest went. Said once, in small type, rather than left for an author
 * to find: on a first run Home is the whole screen below the topbar, and an
 * author who came back to open a saved project needs to be told where it is.
 */
const elsewhere = () => `<p class="home-elsewhere">Coming back to a saved project, or bringing your own drawing? <b>Open Project</b> and <b>Import SVG</b> are in the ••• menu, top right. Once a mascot is open, <b>Blank canvas</b> and <b>Build a face</b> are in Artwork, under Add / Create artwork.</p>`;

export function homeSurfaceMarkup() {
  return `<section class="home-surface" data-home aria-labelledby="home-heading" hidden><div class="home-panel">
    <p class="home-brand">BOOP Mascot Studio</p><h1 id="home-heading" tabindex="-1">Create or continue a mascot</h1>
    <section aria-labelledby="home-start"><h2 id="home-start">New Mascot</h2><div class="home-templates">${characterCard()}${TEMPLATES.map(item=>`<button class="home-card ${item.recommended?'recommended':''}" data-template-id="${item.id}"><span><b>${item.title}</b>${item.recommended?'<em>Recommended</em>':''}</span><small>${item.description}</small><small>${item.capabilities}</small></button>`).join('')}</div>${elsewhere()}</section>
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
