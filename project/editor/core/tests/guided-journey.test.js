import test from 'node:test';
import assert from 'node:assert/strict';
import { installStubDom, clickTarget } from './helpers/stub-dom.js';

installStubDom();

const { GUIDE_STEPS, deriveGuide, guideSummary } = await import('../validation/guide.js');
const { SETUP_SECTIONS, deriveSetupSections } = await import('../validation/setup-sections.js');
const { deriveTaskReadiness } = await import('../validation/task-readiness.js');
const { validateProject } = await import('../validation/validate-project.js');
const { createGuideBar } = await import('../../ui/guide-bar.js');

/** A readiness model with nothing wrong, so a test can move one field at a time. */
const readiness = (over = {}) => ({
  faceSetup: { status: 'todo' }, movements: { status: 'todo' },
  export: { status: 'warning', summary: '', route: { task: 'preview' } },
  ...over
});

const finished = {
  svgMarkup: '<svg/>',
  keyforms: [{ id: 'headPose:head', keyforms: [{ at: [-1, 0] }, { at: [1, 0] }] }],
  hands: { left: { element: 'handL' }, right: { element: 'handR' } },
  expressions: [{ id: 'happy' }], animationClips: [{ id: 'nod' }],
  behaviors: [{ id: 'blink' }], reactions: [{ id: 'click' }]
};

test('the guide names the first unfinished step and counts the journey', () => {
  const guide = deriveGuide({}, readiness());
  assert.equal(guide.total, GUIDE_STEPS.length);
  assert.equal(guide.done, 0);
  assert.equal(guide.required, 3, 'artwork, face parts and movements are the only required steps');
  assert.equal(guide.next.id, 'artwork');
  assert.equal(guide.complete, false);
  assert.equal(guideSummary(guide), `Step 1 of ${guide.total} · Add artwork`);
  // Exactly one step is the current one, and it is the first that is not done.
  assert.deepEqual(guide.steps.filter((step) => step.current).map((step) => step.id), ['artwork']);
});

test('steps flip to done from the document and the readiness model, never from each other', () => {
  const withArtwork = deriveGuide({ svgMarkup: '<svg/>' }, readiness());
  assert.equal(withArtwork.done, 1);
  assert.equal(withArtwork.next.id, 'face-parts', 'artwork done moves the guide on');

  const rigged = deriveGuide({ svgMarkup: '<svg/>' }, readiness({ faceSetup: { status: 'ready' }, movements: { status: 'warning' } }));
  assert.deepEqual(rigged.steps.filter((step) => step.done).map((step) => step.id), ['artwork', 'face-parts', 'movements']);
  assert.equal(rigged.next.id, 'head-pose', 'the optional half of the journey comes next');
  assert.equal(rigged.complete, false, 'optional steps still count towards the total');
});

test('a finished project reports every step done and stops asking for a next one', () => {
  const guide = deriveGuide(finished, readiness({ faceSetup: { status: 'ready' }, movements: { status: 'ready' } }));
  assert.equal(guide.done, guide.total);
  assert.equal(guide.complete, true);
  assert.equal(guide.next, null);
  assert.equal(guide.blocker, null);
  assert.equal(guideSummary(guide), `All ${guide.total} steps done — export when you are ready.`);
});

test('a blocking export problem outranks whatever step comes next', () => {
  const broken = readiness({
    faceSetup: { status: 'ready' }, movements: { status: 'ready' },
    export: { status: 'error', action: 'Fix the artwork', summary: 'No artwork yet', route: { task: 'artwork', target: { kind: 'diagnostic', diagnosticId: 'artwork.missing' } }, issueId: 'artwork.missing' }
  });
  const guide = deriveGuide(finished, broken);
  assert.equal(guide.blocker.id, 'blocker');
  assert.equal(guide.next, guide.blocker, 'the blocker is what the bar offers, not the next step');
  assert.equal(guide.next.label, 'Fix the artwork');
  assert.equal(guide.next.issueId, 'artwork.missing');
  assert.deepEqual(guide.next.route.target, { kind: 'diagnostic', diagnosticId: 'artwork.missing' });
  assert.ok(guide.steps.find((step) => step.id === 'expressions').done, 'a blocker does not un-do the finished steps');
  assert.equal(guide.steps.at(-1).done, false, 'but there is no point trying a project that cannot run');
});

test('the guide reads the real readiness model, not only hand-written ones', () => {
  const empty = { svgMarkup: '', layers: [] };
  const guide = deriveGuide(empty, deriveTaskReadiness(empty, validateProject(empty)));
  assert.equal(guide.blocker.issueId, 'artwork.missing', 'an empty project cannot be exported, so the guide leads with that');
  assert.equal(guide.next, guide.blocker);
  assert.equal(guide.done, 0);
  // Without the validation issues there is no blocker to find, only the journey.
  assert.equal(deriveGuide(empty).blocker, null);
  assert.equal(deriveGuide(empty).next.id, 'artwork');
});

test('Face Setup sections say what is inside before they are opened', () => {
  const sections = deriveSetupSections({});
  assert.deepEqual(sections.map((section) => section.id), SETUP_SECTIONS.map((section) => section.id));
  assert.deepEqual(sections.filter((section) => section.open).map((section) => section.id), ['face-parts'],
    'only the first section is open by default; the panel was three screens tall otherwise');
  assert.deepEqual(new Set(sections.map((section) => section.state)), new Set(['empty']));
  // Short enough to survive a 250px sidebar: the panel body does the teaching.
  assert.ok(sections.every((section) => section.summary.length <= 14), sections.map((section) => section.summary).join(' | '));
  assert.equal(sections.find((section) => section.id === 'hands').summary, 'optional');
  assert.equal(sections.find((section) => section.id === 'warp').summary, 'advanced');
  assert.equal(sections.find((section) => section.id === 'movements').summary, 'parts first');
});

test('section headings grade themselves empty, partial or ready', () => {
  const at = (document, id) => deriveSetupSections(document).find((section) => section.id === id);

  // By id, not by index: a section added ahead of this one is a change to the
  // panel's order and not to how a heading grades itself.
  const declared = (id) => SETUP_SECTIONS.find((section) => section.id === id);
  assert.deepEqual(at({ hands: { left: { element: 'handL' } } }, 'hands'), { ...declared('hands'), summary: 'left only', state: 'partial' });
  assert.equal(at({ hands: { left: { element: 'l' }, right: { element: 'r' } } }, 'hands').state, 'ready');
  assert.equal(at({ hands: { left: {} } }, 'hands').state, 'empty', 'a hand without an element is not a hand');

  const posed = (cells) => ({ keyforms: [{ id: 'headPose:head', keyforms: cells.map((at) => ({ at })) }] });
  assert.deepEqual(at(posed([[1, 0]]), 'head-pose').summary, '1 position');
  assert.equal(at(posed([[1, 0]]), 'head-pose').state, 'partial', 'one position cannot be blended');
  assert.equal(at(posed([[-1, 0], [1, 0]]), 'head-pose').state, 'ready');
  assert.equal(at(posed([[1, 0], [1, 0]]), 'head-pose').summary, '1 position', 'the same cell twice is one position');
  assert.equal(at({ keyforms: [{ id: 'expression:happy', keyforms: [{ at: [1] }] }] }, 'head-pose').state, 'empty');

  assert.equal(at({ warps: [{ id: 'w' }] }, 'warp').summary, '1 warp');
  assert.equal(at({ warps: [{ id: 'a' }, { id: 'b' }] }, 'warp').summary, '2 warps');
  assert.equal(at({ semanticParts: { gaze: {}, mouth: {} } }, 'all-parts').summary, '2 parts');
});

function guideBar(model, { dismissed = false } = {}) {
  const host = document.createElementNS('', 'div');
  const routes = [];
  let isDismissed = dismissed;
  const bar = createGuideBar(host, {
    guide: () => model, navigate: (route) => routes.push(route),
    isDismissed: () => isDismissed, setDismissed: (value) => { isDismissed = value; }
  });
  bar.render();
  const click = (dataset) => host.dispatch('click', { target: clickTarget({ dataset }) });
  return { host, bar, routes, click, get dismissed() { return isDismissed; } };
}

test('the guide bar shows the next step with a way to reach it', () => {
  const model = deriveGuide({ svgMarkup: '<svg/>' }, readiness());
  const ui = guideBar(model);
  assert.equal(ui.host.dataset.guideDone, '1');
  assert.equal(ui.host.dataset.guideTotal, String(model.total));
  assert.match(ui.host.innerHTML, /Assign the face parts/);
  assert.match(ui.host.innerHTML, /Take me there/);
  assert.doesNotMatch(ui.host.innerHTML, /guide-steps/, 'the whole journey stays collapsed until asked for');

  ui.click({ guideAction: 'go', guideStep: 'face-parts' });
  assert.deepEqual(ui.routes, [{ task: 'face-setup', focus: 'face-setup-checklist' }], 'the route opens the section the step is about');
});

test('a blocking problem turns the guide bar into a fix button', () => {
  const model = deriveGuide({}, readiness({ export: { status: 'error', action: 'Add artwork first', summary: 'Nothing to export', route: { task: 'artwork' } } }));
  const ui = guideBar(model);
  assert.match(ui.host.innerHTML, /Fix it/);
  ui.click({ guideAction: 'go', guideStep: 'blocker' });
  assert.deepEqual(ui.routes, [{ task: 'artwork' }], 'an unknown step id falls back to whatever is next');
});

test('the guide bar expands to the whole journey and every step is reachable', () => {
  const model = deriveGuide({ svgMarkup: '<svg/>' }, readiness());
  const ui = guideBar(model);
  ui.click({ guideAction: 'toggle' });
  assert.equal(ui.bar.expanded, true);
  assert.equal(ui.host.dataset.guideExpanded, 'true');
  for (const step of model.steps) assert.match(ui.host.innerHTML, new RegExp(`data-guide-item="${step.id}"`));
  assert.match(ui.host.innerHTML, /data-guide-state="done"/);
  assert.match(ui.host.innerHTML, /data-guide-state="current"/);
  assert.match(ui.host.innerHTML, /<em>optional<\/em>/, 'optional steps say so, so nobody feels blocked by one');

  ui.click({ guideAction: 'go', guideStep: 'reactions' });
  assert.deepEqual(ui.routes, [{ task: 'reactions' }], 'a step can be reached out of order');
  assert.equal(ui.bar.expanded, false, 'the list collapses on the way out, off the panel it just opened');
});

test('dismissing the guide leaves a handle that brings it back', () => {
  const model = deriveGuide({ svgMarkup: '<svg/>' }, readiness());
  const ui = guideBar(model);
  ui.click({ guideAction: 'dismiss' });
  assert.equal(ui.dismissed, true);
  assert.match(ui.host.innerHTML, /Steps 1\/10/);
  assert.doesNotMatch(ui.host.innerHTML, /Take me there/);

  ui.click({ guideAction: 'restore' });
  assert.equal(ui.dismissed, false);
  assert.equal(ui.bar.expanded, true, 'coming back shows the whole journey, which is why it was reopened');
  assert.match(ui.host.innerHTML, /guide-steps/);
});

test('the guide bar escapes step text rather than trusting it as markup', () => {
  const model = { ...deriveGuide({}, readiness()), next: { id: 'x', label: '<img src=x>', hint: '"quoted"' }, steps: [], done: 0, total: 1 };
  const ui = guideBar(model);
  assert.doesNotMatch(ui.host.innerHTML, /<img/);
  assert.match(ui.host.innerHTML, /&lt;img src=x&gt;/);
});

test('the guide bar refuses to render without its host, rather than silently doing nothing', () => {
  assert.throws(() => createGuideBar(null, {}), /#guide-bar/);
});
