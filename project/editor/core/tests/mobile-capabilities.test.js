import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITY_GROUPS, CAPABILITY_LEVELS, MOBILE_POLICY, capabilityGroups, capabilityMap, describeCapability, gateMarkup } from '../../ui/mobile-capabilities.js';
import { WORKSPACE_ORDER } from '../../ui/task-router.js';

test('mobile policy keeps save, export and preview full, gates precision work with a handoff, and never gates larger screens', () => {
  for (const [area, policy] of Object.entries(MOBILE_POLICY)) {
    assert.ok(CAPABILITY_LEVELS.includes(policy.level), `${area} has a known level`);
    if (policy.level !== 'full') assert.ok(policy.handoff, `${area} explains where to do it instead`);
  }
  assert.deepEqual(['preview', 'export', 'expressions', 'reactions', 'automatic'].map((area) => describeCapability(area, 'mobile').level), ['full', 'full', 'full', 'full', 'full']);
  assert.deepEqual(['timeline', 'morphs'].map((area) => describeCapability(area, 'mobile').level), ['unavailable', 'unavailable']);
  assert.equal(describeCapability('artwork', 'mobile').level, 'limited');
  assert.equal(describeCapability('timeline', 'tablet').gated, false);
  assert.equal(describeCapability('timeline', 'desktop').gated, false);
  assert.equal(describeCapability('unknown-area', 'mobile').gated, false);
  assert.equal(capabilityMap('mobile').filter((item) => item.gated).length, 11);
  assert.equal(capabilityMap('desktop').filter((item) => item.gated).length, 0);
  assert.equal(gateMarkup('timeline', 'desktop'), '');
  const gate = gateMarkup('timeline', 'mobile');
  assert.match(gate, /data-mobile-gate="timeline"/);
  assert.match(gate, /Not on phones/);
  assert.match(gate, /tablet or desktop/);
  assert.match(gateMarkup('artwork', 'mobile'), /Limited on phones/);
});

/**
 * UIR-15 — the policy reads as the navigation reads.
 *
 * The sheet is the answer to "can I do this here", so the list has to be the
 * list of screens an author sees. One filed under a question nobody navigates
 * to would never be shown, and a screen with no entry reads as one that is
 * simply missing.
 */
test('every capability is filed under a workspace the navigation has, and every screen of Design and Rig has one', () => {
  const groups = [...WORKSPACE_ORDER, 'global'];
  assert.deepEqual(Object.keys(CAPABILITY_GROUPS), groups, 'the groups are the four questions, then what is true everywhere');
  for (const [area, policy] of Object.entries(MOBILE_POLICY)) {
    assert.ok(groups.includes(policy.workspace), `${area} is filed under a group that exists`);
  }
  // The four screens the refactor gave a door of their own are the four most
  // likely to be left out of a list written before they had one.
  assert.deepEqual(['hands', 'face-setup', 'head-pose', 'deform'].map((area) => describeCapability(area, 'mobile').label), ['Hands', 'Assign', 'Head 2.5D', 'Deform']);
  const grouped = capabilityGroups('mobile');
  assert.deepEqual(grouped.map((group) => group.id), groups);
  assert.deepEqual(grouped.flatMap((group) => group.items.map((item) => item.area)), Object.keys(MOBILE_POLICY), 'every area reaches exactly one group, in the policy\u2019s own order');
  assert.deepEqual(capabilityGroups('desktop').flatMap((group) => group.items.filter((item) => item.gated)), [], 'nothing is gated on a desktop, grouped or not');
});
