import test from 'node:test';
import assert from 'node:assert/strict';
import { findUnsafeSvg, sanitizeSvgMarkup } from '../security/sanitize-svg.js';
import { assetRef } from '../../../runtime/asset-reference.js';

const ID = '7f3c9a1b2c3d4e5f';
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`;
const kept = (body) => sanitizeSvgMarkup(svg(body)).replace(/<svg[^>]*>|<\/svg>/g, '');

test("a project's own asset survives the cleaner, on either attribute",()=>{
  assert.match(kept(`<image href="${assetRef(ID)}"/>`),/href="asset:7f3c9a1b2c3d4e5f"/);
  assert.match(kept(`<image xlink:href="${assetRef(ID)}"/>`),/asset:7f3c9a1b2c3d4e5f/);
  assert.deepEqual(findUnsafeSvg(svg(`<image href="${assetRef(ID)}"/>`)),[]);
  // And a fragment still does, which is what it always did.
  assert.match(kept('<use href="#head"/>'),/href="#head"/);
});

test('the allowance is one shape, not one prefix',()=>{
  // Everything here starts with `asset:` and none of it is a reference. The
  // strictness of the id is the whole safety argument for allowing the scheme.
  for (const value of [
    'asset:../../etc/passwd', 'asset:http://evil.example/x', 'asset:javascript:alert(1)',
    'asset://evil.example/x', `asset:${ID}?x=1`, `asset:${ID}#frag`, 'asset:', 'asset:ZZZZZZZZ',
    'asset:7f3c', `asset: ${ID}`
  ]) {
    assert.doesNotMatch(kept(`<image href="${value}"/>`),/href=/,value);
    assert.deepEqual(findUnsafeSvg(svg(`<image href="${value}"/>`)).map((f) => f.kind),['external-reference'],value);
  }
});

test('nothing that could reach the network became allowed',()=>{
  for (const value of ['http://evil.example/a.png', '//evil.example/a.png', 'data:image/png;base64,AAAA', 'blob:http://x/y', 'javascript:alert(1)', 'file:///etc/passwd'])
    assert.doesNotMatch(kept(`<image href="${value}"/>`),/href=/,value);
  // And the rest of the cleaner is untouched by the new allowance.
  assert.doesNotMatch(kept(`<image href="${assetRef(ID)}" onload="steal()"/>`),/onload/);
  assert.doesNotMatch(sanitizeSvgMarkup(svg(`<script>x()</script><image href="${assetRef(ID)}"/>`)),/<script/);
  assert.doesNotMatch(kept(`<image href="${assetRef(ID)}" fill="url(http://evil.example/x)"/>`),/fill=/);
});

test('the cleaner and the scan answer the same question',()=>{
  // Two lists of rules is a list that drifts, which is why they share a
  // predicate rather than each having their own.
  for (const value of [assetRef(ID), '#head', 'http://evil.example/a.png', 'asset:nope', `asset:${ID}?x=1`, '']) {
    const markup = svg(`<image href="${value}"/>`);
    const survives = /href=/.test(sanitizeSvgMarkup(markup));
    const reported = findUnsafeSvg(markup).some((found) => found.kind === 'external-reference');
    assert.equal(survives,!reported,`${value}: cleaner says ${survives}, scan says ${!reported}`);
  }
});
