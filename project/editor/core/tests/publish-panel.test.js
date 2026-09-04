import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublishPanel } from '../../ui/publish-panel.js';

/**
 * The Publish column (VNX-10). It is a second *view* of the readiness model
 * every badge already shares, never a second computation — so these tests hand
 * it a readiness report and check what it says about it, nothing more.
 */

function fakeHost() {
  const listeners = new Map();
  return {
    innerHTML: '', dataset: {}, hidden: false,
    addEventListener: (type, handler) => { listeners.set(type, [...(listeners.get(type) || []), handler]); },
    removeEventListener: (type, handler) => { listeners.set(type, (listeners.get(type) || []).filter((item) => item !== handler)); },
    dispatch: (type, event) => (listeners.get(type) || []).forEach((handler) => handler(event)),
    count: (type) => (listeners.get(type) || []).length
  };
}

const clickOn = (dataset) => ({ target: { closest: (selector) => (selector === 'button[data-publish]' ? { dataset } : null) } });

const REPORT = {
  order: ['artwork', 'export'],
  artwork: { id: 'artwork', label: 'Artwork', status: 'ready', summary: 'Head and face' },
  export: { id: 'export', label: 'Export', status: 'ready', summary: 'Ready to export' }
};

function panel({ report = REPORT, list = [] } = {}) {
  const host = fakeHost(), went = [], fixed = [], exported = [];
  const ui = createPublishPanel(host, {
    readiness: () => report, issues: () => list,
    onGo: (section) => went.push(section?.id), onFix: (issue) => fixed.push(issue?.id), onExport: () => exported.push(true)
  });
  return { host, ui, went, fixed, exported };
}

test('a project with nothing in it has nothing to publish, and says nothing', () => {
  const { host, ui } = panel({ report: null });
  ui.render();
  assert.equal(host.innerHTML, '', 'an empty project must not be told it is ready');
});

test('a clean project says it is ready, and blocks nothing', () => {
  const { host, ui } = panel();
  ui.render();
  assert.equal(host.dataset.publishBlocking, '0');
  assert.match(host.innerHTML, /Ready\. Everything the runtime needs/);
  assert.match(host.innerHTML, /data-publish-step="artwork"/);
  assert.match(host.innerHTML, /data-publish-step="export"/);
});

test('warnings do not block, and are counted rather than hidden', () => {
  const { host, ui } = panel({ list: [{ id: 'a', severity: 'warning', message: 'A reaction has no expression' }] });
  ui.render();
  assert.equal(host.dataset.publishBlocking, '0');
  assert.match(host.innerHTML, /Ready\. 1 warning/);
  assert.match(host.innerHTML, /the mascot may not do everything you meant/);
});

test('an error blocks, is named, and carries the way out of itself', () => {
  const { host, ui, fixed } = panel({ list: [
    { id: 'artwork.missing', severity: 'error', message: 'No artwork yet', fix: { workspace: 'artwork' } },
    { id: 'rig.broken', severity: 'error', message: 'A binding points nowhere' }
  ] });
  ui.render();
  assert.equal(host.dataset.publishBlocking, '2');
  assert.match(host.innerHTML, /2 problems still block the export/);
  assert.match(host.innerHTML, /No artwork yet/);
  // Only the issue that names a fix offers one; the other is still reported.
  assert.match(host.innerHTML, /data-publish-blocker="rig.broken"/);
  assert.equal((host.innerHTML.match(/data-publish="fix"/g) || []).length, 1);
  host.dispatch('click', clickOn({ publish: 'fix', publishId: 'artwork.missing' }));
  assert.deepEqual(fixed, ['artwork.missing']);
});

test('one problem reads as one problem', () => {
  const { host, ui } = panel({ list: [{ id: 'a', severity: 'error', message: 'Nope' }] });
  ui.render();
  assert.match(host.innerHTML, /1 problem still blocks the export/);
});

test('the checklist routes to the step, and Export ships', () => {
  const { host, ui, went, exported } = panel();
  ui.render();
  host.dispatch('click', clickOn({ publish: 'go', publishId: 'export' }));
  assert.deepEqual(went, ['export']);
  host.dispatch('click', clickOn({ publish: 'export' }));
  assert.deepEqual(exported, [true]);
});

test('an unchanged report is not redrawn, and destroying takes the listener with it', () => {
  const { host, ui } = panel();
  ui.render();
  const drawn = ui.counters().renders;
  host.innerHTML = 'still on screen';
  assert.equal(ui.render(), false);
  assert.equal(host.innerHTML, 'still on screen');
  assert.equal(ui.counters().renders, drawn);
  assert.equal(host.count('click'), 1);
  ui.destroy();
  assert.equal(host.count('click'), 0);
});

test('the export is weighed on request, not on every validation pass', () => {
  // Weighing serializes the SVG and builds the rig. Doing that for a number
  // nobody asked for, on every pass, is exactly the kind of cost the runtime
  // rules forbid per frame and the editor should not pay per keystroke either.
  let weighed = 0, rev = 1;
  const host = fakeHost();
  const ui = createPublishPanel(host, {
    readiness: () => REPORT, issues: () => [],
    weigh: () => { weighed += 1; return [{ name: 'mascot.svg', contents: 'x'.repeat(2048) }, { name: 'rig.json', contents: 'y'.repeat(1024) }]; },
    revision: () => rev
  });
  ui.render();
  assert.equal(weighed, 0, 'rendering the column must not weigh anything');
  assert.match(host.innerHTML, /How big is it\?/);

  host.dispatch('click', clickOn({ publish: 'weigh' }));
  assert.equal(weighed, 1);
  assert.match(host.innerHTML, /mascot\.svg 2 kB/);
  assert.match(host.innerHTML, /rig\.json 1 kB/);
  assert.match(host.innerHTML, /uncompressed/, 'a raw byte count that pretends to be the download size would be a lie');

  // A weight from three edits ago is worse than no weight: it looks current.
  rev = 2;
  ui.render();
  assert.equal(host.innerHTML.includes('mascot.svg'), false, 'the stale weight was still on screen');
  assert.match(host.innerHTML, /How big is it\?/);
});

test('a panel given no way to weigh does not offer one', () => {
  const { host, ui } = panel();
  ui.render();
  assert.equal(host.innerHTML.includes('data-publish="weigh"'), false);
});
