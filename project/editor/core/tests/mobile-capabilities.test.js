import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITY_LEVELS, MOBILE_POLICY, capabilityMap, describeCapability, gateMarkup } from '../../ui/mobile-capabilities.js';

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
  assert.equal(capabilityMap('mobile').filter((item) => item.gated).length, 8);
  assert.equal(capabilityMap('desktop').filter((item) => item.gated).length, 0);
  assert.equal(gateMarkup('timeline', 'desktop'), '');
  const gate = gateMarkup('timeline', 'mobile');
  assert.match(gate, /data-mobile-gate="timeline"/);
  assert.match(gate, /Not on phones/);
  assert.match(gate, /tablet or desktop/);
  assert.match(gateMarkup('artwork', 'mobile'), /Limited on phones/);
});
