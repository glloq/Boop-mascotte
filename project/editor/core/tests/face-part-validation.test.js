import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFacePart } from '../face-library/face-part-validation.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { MOUTH_SIMPLE } from '../face-library/builtin/mouth-simple.js';
import { MOUTH_WIDE } from '../face-library/builtin/mouth-wide.js';
import { findUnsafeSvg } from '../security/sanitize-svg.js';

/**
 * Whether an asset may enter the library (roadmap phase 24). One code per
 * refusal, each proved by the smallest asset that trips it and by the
 * built-in assets that trip none.
 */
const codes = (result) => result.issues.map((item) => item.code);
const errors = (result) => result.errors.map((item) => item.code);
const variant = (over = {}) => ({ ...MOUTH_SIMPLE, ...over });

test('every built-in asset is valid, and the incomplete ones say so as a warning', () => {
  for (const asset of BUILTIN_FACE_PARTS) {
    const result = validateFacePart(asset);
    assert.equal(result.ok, true, `${asset.id}: ${errors(result).join(', ')}`);
    assert.deepEqual(errors(result), []);
  }
  assert.deepEqual(codes(validateFacePart(MOUTH_SIMPLE)), ['capabilities-incomplete'], 'a mouth with nothing inside it is limited, and allowed');
  assert.match(validateFacePart(MOUTH_SIMPLE).warnings[0].message, /teeth, tongue are not carried/);
  assert.deepEqual(codes(validateFacePart(MOUTH_WIDE)), ['capabilities-incomplete']);
  assert.deepEqual(codes(validateFacePart(BUILTIN_FACE_PARTS.find((asset) => asset.id === 'nose.dot'))), [], 'a nose that scrunches carries everything a nose can');
});

test('the id names the category and the asset, once', () => {
  assert.deepEqual(errors(validateFacePart(variant({ id: '' }))), ['id-missing']);
  assert.deepEqual(errors(validateFacePart(variant({ id: 'Mouth Simple' }))), ['id-format']);
  assert.deepEqual(errors(validateFacePart(variant({ id: 'nose.simple' }))), ['id-category']);
  assert.deepEqual(errors(validateFacePart(variant(), { taken: (id) => id === 'mouth.simple' })), ['id-taken']);
  assert.deepEqual(validateFacePart(variant({ id: '' })).errors[0].field, 'id');
});

test('the category is known, and names it when it cannot install yet', () => {
  assert.deepEqual(errors(validateFacePart(variant({ id: 'hat.top', category: 'hat' }))), ['category-unknown']);
  const beard = validateFacePart({ id: 'facialhair.beard', category: 'facialHair', name: 'Beard', artwork: '<g id="beard"><path id="hairs" d="M0 0"/></g>', referenceBox: { x: 0, y: 0, width: 1, height: 1 } });
  assert.equal(beard.ok, true, 'listed');
  assert.deepEqual(codes(beard), ['not-installable']);
  assert.deepEqual(errors(validateFacePart(variant({ name: '  ' }))), ['name-missing']);
});

test('the artwork is one safe, well-formed fragment with distinct ids', () => {
  assert.deepEqual(errors(validateFacePart(variant({ artwork: '' }))), ['artwork-missing', 'role-artwork-missing']);
  assert.deepEqual(errors(validateFacePart(variant({ artwork: '<g id="mouth-simple"><path id="mouth"/>' }))), ['artwork-malformed']);
  assert.deepEqual(errors(validateFacePart(variant({ artwork: '<path id="mouth"/><path id="lip"/>' }))), ['artwork-malformed'], 'two roots');
  assert.deepEqual(errors(validateFacePart(variant({ artwork: '<svg><path id="mouth"/></svg>' }))), ['artwork-malformed'], 'a whole document');
  assert.deepEqual(errors(validateFacePart(variant({ artwork: '<g id="mouth-simple"><path id="mouth"/><path id="mouth"/></g>' }))), ['artwork-duplicate-id']);
  const unsafe = validateFacePart(variant({ artwork: '<g id="mouth-simple" onload="evil()"><script>evil()</script><path id="mouth" d="M0 0"/><use href="https://evil.test/x.svg"/></g>' }));
  assert.deepEqual(errors(unsafe), ['artwork-unsafe', 'artwork-unsafe', 'artwork-unsafe']);
  assert.match(unsafe.errors[0].message, /a script/);
  assert.match(unsafe.errors[1].message, /event handler \(onload\)/);
  assert.match(unsafe.errors[2].message, /external reference/);
  assert.equal(validateFacePart(variant({ artwork: "<g id=\"mouth-simple\"><path id='mouth' d='M0 0' fill=\"url(#shine)\"/></g>" })).ok, true, 'an internal reference is fine');
});

test('the scan lists exactly what the sanitizer removes, sharing its rules', () => {
  assert.deepEqual(findUnsafeSvg('<svg onload="evil()"><script>evil()</script><foreignObject>x</foreignObject><a href="javascript:evil()" onclick="evil()"/></svg>').map((item) => item.kind),
    ['script', 'foreign-object', 'event-handler', 'event-handler', 'external-reference']);
  assert.deepEqual(findUnsafeSvg(`<svg><defs><linearGradient id="g"/><clipPath id="c"/></defs><rect fill='url("#g")' clip-path="url('#c')"/><circle style="filter:url('#g')"/></svg>`), [], 'internal references and internal CSS are kept');
  assert.deepEqual(findUnsafeSvg(`<svg><rect style="fill:url(https://evil.test/x)"/><style>@import 'https://evil.test/x';</style></svg>`).map((item) => item.kind), ['external-css', 'external-css']);
  assert.deepEqual(findUnsafeSvg('<rect fill="url( javascript:alert(1) )" xml:base="x"/>').map((item) => item.kind), ['base', 'javascript-url']);
  assert.deepEqual(findUnsafeSvg(''), []);
  assert.deepEqual(findUnsafeSvg(null), []);
});

test('roles are the part\'s, name shapes the artwork draws, and cover what the part needs', () => {
  assert.deepEqual(errors(validateFacePart(variant({ roles: { mouth: 'mouth', beak: 'mouth' } }))), ['role-unknown', 'role-shared']);
  assert.deepEqual(errors(validateFacePart(variant({ roles: { mouth: 'lips' } }))), ['role-artwork-missing']);
  assert.deepEqual(errors(validateFacePart(variant({ roles: {} }))), ['role-required-missing']);
  assert.deepEqual(errors(validateFacePart({ ...MOUTH_WIDE, roles: { mouth: 'mouth', teeth: 'mouth' } })), ['role-shared']);
  const eyes = validateFacePart({ id: 'eyes.one', category: 'eyes', name: 'One', artwork: '<g id="eyes-one"><circle id="left"/></g>', roles: { leftEye: 'left' }, referenceBox: { x: 0, y: 0, width: 1, height: 1 } });
  assert.deepEqual(errors(eyes), ['role-required-missing']);
  assert.equal(eyes.errors[0].field, 'roles.rightEye');
});

test('capabilities, mount point, reference box and palette are checked against what exists', () => {
  assert.deepEqual(errors(validateFacePart(variant({ capabilities: ['smile', 'hairSway'] }))), ['capability-unsupported']);
  assert.deepEqual(errors(validateFacePart(variant({ mountPoint: 'chin' }))), ['mount-point-unknown']);
  assert.equal(validateFacePart(variant({ mountPoint: 'head.bottom' })).ok, true);
  for (const box of [undefined, {}, { x: 0, y: 0, width: 0, height: 1 }, { x: 'a', y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 1, height: -1 }]) {
    assert.deepEqual(errors(validateFacePart(variant({ referenceBox: box }))), ['reference-box-invalid'], JSON.stringify(box));
  }
  assert.deepEqual(errors(validateFacePart(variant({ palette: ['mouth', 'lipstick'] }))), ['palette-token-unknown']);
  const wreck = validateFacePart({});
  assert.equal(wreck.ok, false);
  assert.deepEqual(errors(wreck), ['id-missing', 'category-unknown', 'name-missing', 'artwork-missing', 'reference-box-invalid']);
});
