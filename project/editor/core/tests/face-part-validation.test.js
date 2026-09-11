import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFacePart } from '../face-library/face-part-validation.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { MOUTH_SIMPLE } from '../face-library/builtin/mouth-simple.js';
import { MOUTH_WIDE } from '../face-library/builtin/mouth-wide.js';
import { findUnsafeSvg, sanitizeSvgMarkup } from '../security/sanitize-svg.js';

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

test('the category is known, and every one of the eleven can install', () => {
  assert.deepEqual(errors(validateFacePart(variant({ id: 'hat.top', category: 'hat' }))), ['category-unknown']);
  const beard = validateFacePart({ id: 'facialhair.beard', category: 'facialHair', name: 'Beard', artwork: '<g id="beard"><path id="hairs" d="M0 0"/></g>', referenceBox: { x: 0, y: 0, width: 1, height: 1 } });
  assert.deepEqual(errors(beard), ['role-required-missing'], 'facial hair is a part now: the drawing has to say which shape plays it');
  assert.equal(validateFacePart({ id: 'facialhair.beard', category: 'facialHair', name: 'Beard', artwork: '<g id="beard"><path id="hairs" d="M0 0"/></g>', roles: { facialHair: 'hairs' }, referenceBox: { x: 0, y: 0, width: 1, height: 1 } }).ok, true);
  assert.deepEqual(errors(validateFacePart(variant({ depth: 2 }))), ['depth-out-of-range']);
  assert.equal(validateFacePart(variant({ depth: -0.5 })).asset.depth, -0.5);
  assert.deepEqual(errors(validateFacePart(variant({ name: '  ' }))), ['name-missing']);
});

test('the artwork is one safe, well-formed fragment with distinct ids', () => {
  assert.deepEqual(errors(validateFacePart(variant({ artwork: '' }))), ['artwork-missing', 'role-artwork-missing', 'palette-role-unknown'], 'no artwork: the role and the paint both name a shape that is not drawn');
  assert.deepEqual(errors(validateFacePart(variant({ artwork: '<g id="mouth-simple"><path id="mouth"/>' }))), ['artwork-malformed']);
  assert.deepEqual(errors(validateFacePart(variant({ artwork: '<path id="mouth"/><path id="lip"/>' }))), ['artwork-malformed'], 'two roots');
  assert.deepEqual(errors(validateFacePart(variant({ artwork: '<svg><path id="mouth"/></svg>' }))), ['artwork-malformed'], 'a whole document');
  assert.deepEqual(errors(validateFacePart(variant({ artwork: '<g><path id="mouth" d="M0 0"/></g>' }))), ['artwork-root-id'], 'the root is what the part is known by once installed');
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
  assert.deepEqual(findUnsafeSvg('<rect fill="url( javascript:alert(1) )" xml:base="x"/>').map((item) => item.kind), ['base', 'external-reference', 'javascript-url'], 'a paint reaching outside the document is named as such, and as the javascript url it is');
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

test('the other parts an asset draws are real parts with real roles, each shape playing one role in the whole', () => {
  const eyes = (over = {}) => validateFacePart({ id: 'eyes.pair', category: 'eyes', name: 'Pair', referenceBox: { x: 0, y: 0, width: 1, height: 1 }, artwork: '<g id="eyes-pair"><g id="l"><circle id="pl"/><path id="ul"/><path id="ll"/></g><g id="r"><circle id="pr"/><path id="ur"/><path id="lr"/></g></g>', roles: { leftEye: 'l', rightEye: 'r' }, capabilities: ['eyeOpen'], parts: { gaze: { roles: { leftPupil: 'pl', rightPupil: 'pr' }, capabilities: ['lookX', 'lookY', 'pupilScale'] }, eyelids: { roles: { leftUpper: 'ul', leftLower: 'll', rightUpper: 'ur', rightLower: 'lr' }, capabilities: ['eyeOpen'], drivers: { eyeOpen: { property: 'translateY', amplitude: -20, offset: 20, roles: { leftLower: { amplitude: 20, offset: -20 } } } } } }, ...over });
  assert.equal(eyes().ok, true, errors(eyes()).join(', '));
  assert.deepEqual(codes(eyes()), []);
  assert.deepEqual(errors(eyes({ parts: { wings: { roles: {} } } })), ['parts-unknown']);
  assert.deepEqual(errors(eyes({ parts: { eyes: { roles: { leftEye: 'l' } } } })), ['parts-own']);
  assert.deepEqual(errors(eyes({ parts: { gaze: { roles: { leftPupil: 'pl', beak: 'pr' } } } })), ['parts-role-unknown']);
  assert.deepEqual(errors(eyes({ parts: { gaze: { roles: { leftPupil: 'nope', rightPupil: 'pr' } } } })), ['role-artwork-missing']);
  assert.deepEqual(errors(eyes({ parts: { gaze: { roles: { leftPupil: 'l', rightPupil: 'pr' } } } })), ['role-shared'], 'the left eye cannot also be the left pupil');
  assert.deepEqual(errors(eyes({ parts: { gaze: { roles: { leftPupil: 'pl', rightPupil: 'pr' }, capabilities: ['smile'] } } })), ['capability-unsupported']);
  // A driver names a movement the drawing claims, a property a binding writes, roles the asset draws.
  assert.deepEqual(errors(eyes({ drivers: { eyeOpen: { property: 'scaleY', amplitude: 0.12, offset: 0.88 } } })), []);
  assert.deepEqual(errors(eyes({ drivers: { smile: { property: 'scaleY', amplitude: 1 } } })), ['driver-unknown']);
  assert.deepEqual(errors(eyes({ drivers: { eyeOpen: { property: 'wobble', amplitude: 1 } } })), ['driver-property-unknown']);
  assert.deepEqual(errors(eyes({ drivers: { eyeOpen: { property: 'scaleY' } } })), ['driver-amplitude-invalid']);
  // A shape driver is the shape at the movement's end, not a number.
  assert.deepEqual(errors(eyes({ drivers: { eyeOpen: { property: 'shapeKey' } } })), ['driver-pose-missing']);
  assert.deepEqual(errors(eyes({ drivers: { eyeOpen: { property: 'shapeKey', posePath: 'M0 0 L1 1 Z' } } })), []);
  assert.deepEqual(errors(eyes({ drivers: { eyeOpen: { property: 'scaleY', amplitude: 1, roles: { nose: { amplitude: 2 } } } } })), ['driver-role-unknown']);
  const bad = eyes({ parts: { eyelids: { roles: { leftUpper: 'ul' }, capabilities: ['eyeOpen'], drivers: { eyeOpen: { property: 'translateY', amplitude: -20, roles: { rightUpper: { amplitude: 1 } } } } } } });
  assert.deepEqual(errors(bad), ['driver-role-unknown']);
  assert.equal(bad.errors[0].field, 'parts.eyelids.drivers.eyeOpen.roles.rightUpper');
});

test('a turn profile names a role the asset draws, and says something the turn can read', () => {
  const turning = (turn) => validateFacePart(variant({ turn }));
  assert.deepEqual(errors(turning({ mouth: { depth: 0.85, side: null, narrow: true } })), [], 'a mouth that says how it turns');
  assert.deepEqual(errors(turning({ cavity: { depth: 0.85 } })), ['turn-role-unknown'], 'this drawing has no cavity to turn');
  // A flag nobody knows is dropped on the way in, so a profile that says
  // nothing is a profile that meant to say something.
  assert.deepEqual(errors(turning({ mouth: { dpeth: 0.85 } })), ['turn-empty']);
  assert.deepEqual(errors(turning({ mouth: { depth: 'far' } })), ['turn-value-invalid']);
  assert.deepEqual(errors(turning({ mouth: { tilt: 0.3, foreshorten: 'half' } })), ['turn-value-invalid']);
  assert.equal(turning({ mouth: { foreshorten: 'half' } }).errors[0].field, 'turn.mouth.foreshorten');
  assert.deepEqual(errors(turning({ mouth: { side: 'middle' } })), ['turn-side-unknown']);
  assert.equal(turning({ mouth: { depth: 0.85 } }).asset.turn.mouth.depth, 0.85);
  // The other parts an asset draws say it the same way, and are named the same way when they do not.
  const eyes = (over) => validateFacePart({ id: 'eyes.pair', category: 'eyes', name: 'Pair', referenceBox: { x: 0, y: 0, width: 1, height: 1 }, artwork: '<g id="eyes-pair"><circle id="l"/><circle id="r"/><circle id="pl"/><circle id="pr"/></g>', roles: { leftEye: 'l', rightEye: 'r' }, parts: { gaze: { roles: { leftPupil: 'pl', rightPupil: 'pr' }, ...over } } });
  assert.deepEqual(errors(eyes({ turn: { leftPupil: { depth: 0.62, side: 'left' } } })), []);
  const wrong = eyes({ turn: { leftBrow: { depth: 0.6 } } });
  assert.deepEqual(errors(wrong), ['turn-role-unknown']);
  assert.equal(wrong.errors[0].field, 'parts.gaze.turn.leftBrow');
});

test('palette roles name shapes the artwork draws and tokens the palette has, and stand in for the palette list', () => {
  const asset = validateFacePart(variant({ palette: undefined, paletteRoles: { mouth: { stroke: 'mouth' } } }));
  assert.equal(asset.ok, true, errors(asset).join(', '));
  assert.deepEqual([...asset.asset.palette], ['mouth'], 'derived from the roles');
  assert.deepEqual(errors(validateFacePart(variant({ paletteRoles: { lips: { fill: 'mouth' } } }))), ['palette-role-unknown']);
  assert.deepEqual(errors(validateFacePart(variant({ paletteRoles: { mouth: { fill: 'lipstick' } } }))), ['palette-token-unknown']);
  assert.equal(validateFacePart(variant({ paletteRoles: { mouth: { fill: 'lipstick' } } })).errors[0].field, 'paletteRoles.mouth.fill');
  for (const item of BUILTIN_FACE_PARTS) if (item.id !== 'hair.bald') assert.ok(Object.keys(item.paletteRoles).length, `${item.id} says which tokens its paints play`);
});

test('a tag the scanner cannot read in full is malformed, not skipped: an attribute glued onto a value, an unquoted one; a comment is not a tag', () => {
  const glued = validateFacePart(variant({ artwork: '<g id="mouth-simple"><img src=""onerror="alert(1)"><path id="mouth"/></g>' }));
  assert.ok(errors(glued).includes('artwork-malformed'), errors(glued).join(' '));
  assert.ok(errors(glued).includes('artwork-unsafe'), 'and the handler is seen for what it is');
  assert.deepEqual(errors(validateFacePart(variant({ artwork: '<g id="mouth-simple"><rect width=10 height=10/><path id="mouth"/></g>' }))), ['artwork-malformed'], 'an unquoted attribute');
  assert.deepEqual(errors(validateFacePart(variant({ artwork: '<g id="mouth-simple"><!-- a note --><path id="mouth"/></g>' }))), [], 'a comment is fine');
});

test('a driver hint without an offset has none, and one with an offset that is not a number is refused', () => {
  const hinted = (drivers) => variant({ capabilities: ['mouthOpen', 'smile'], drivers });
  const none = validateFacePart(hinted({ smile: { property: 'translateY', amplitude: 4 } }));
  assert.deepEqual(errors(none), []);
  assert.equal(none.asset.drivers.smile.offset, null, 'left out: the binding takes the property\'s own rest');
  assert.deepEqual(errors(validateFacePart(hinted({ smile: { property: 'translateY', amplitude: 4, offset: 'up' } }))), ['driver-offset-invalid']);
});

test('a paint that reaches outside the document is unsafe: a fill fetching a url, and a colour with a declaration smuggled after it', () => {

  const smuggled = validateFacePart(variant({ artwork: '<g id="mouth-simple"><path id="mouth" d="M0 0" fill="#fff;background:url(https://evil.example/leak)"/></g>' }));
  assert.ok(errors(smuggled).includes('artwork-unsafe'), errors(smuggled).join(' '));
  assert.ok(errors(validateFacePart(variant({ artwork: '<g id="mouth-simple"><path id="mouth" d="M0 0" filter="url(https://evil.example/f.svg#blur)"/></g>' }))).includes('artwork-unsafe'));
  assert.deepEqual(findUnsafeSvg('<svg><rect fill="url(https://evil.example/p)" stroke=\'url( "#g" )\' mask="url(#m)"/></svg>').map((item) => item.kind), ['external-reference']);
  // The cleaner's rule is the same: the paint goes, the shape stays (the fallback cleaner, here; the parser branch shares the predicate).
  const cleaned = sanitizeSvgMarkup('<svg><path d="M0 0" fill="#fff;background:url(https://evil.example/leak)" stroke="url(#g)"/></svg>');
  assert.doesNotMatch(cleaned, /evil\.example/);
  assert.match(cleaned, /stroke="url\(#g\)"/, 'an internal reference stays');
});

test('a reference the scan reads as the parser would: a character reference does not hide a url, and a cursor fetches too', () => {
  assert.deepEqual(findUnsafeSvg('<svg><rect fill="&#117;rl(https://evil.example/p)"/></svg>').map((item) => item.kind), ['external-reference']);
  assert.deepEqual(findUnsafeSvg('<svg><rect style="fill:&#x75;rl(https://evil.example/p)"/></svg>').map((item) => item.kind), ['external-css']);
  assert.deepEqual(findUnsafeSvg('<svg><rect cursor="url(https://evil.example/c.cur)"/></svg>').map((item) => item.kind), ['external-reference']);
  assert.doesNotMatch(sanitizeSvgMarkup('<svg><rect fill="&#117;rl(https://evil.example/p)" cursor="url(https://evil.example/c.cur)"/></svg>'), /evil\.example/);
  assert.deepEqual(findUnsafeSvg('<svg><rect fill="&amp;#117;rl(#g)"/></svg>'), [], 'a reference into the document, however written, is fine');
});

test('the cleaner takes out everything the scan names, whichever way it is spelled', () => {
  // A `<style>` body is decoded before it is read, exactly as an attribute is:
  // the scan reported these two already, and the cleaner used to keep them.
  for (const markup of ['<svg><style>.a{fill:&#x75;rl(https://evil.example/x)}</style><rect/></svg>', '<svg><style>&#64;import "https://evil.example/x";</style><rect/></svg>']) {
    assert.deepEqual(findUnsafeSvg(markup).map((item) => item.kind), ['external-css'], markup);
    assert.doesNotMatch(sanitizeSvgMarkup(markup), /evil\.example/, markup);
  }
  assert.match(sanitizeSvgMarkup('<svg><style>.a{fill:url(#g)}</style><rect/></svg>'), /url\(#g\)/, 'a style that stays inside the document stays');
  // `marker` is the SVG 2 shorthand for the three `marker-*`, and fetches as they do.
  const marker = '<svg><path marker="url(https://evil.example/m.svg#m)"/></svg>';
  assert.deepEqual(findUnsafeSvg(marker).map((item) => item.kind), ['external-reference']);
  assert.doesNotMatch(sanitizeSvgMarkup(marker), /evil\.example/);
});

test('a character reference outside Unicode is answered, not thrown over', () => {
  // `validateFacePart` promises a list of issues for any input at all: a code
  // point no character has used to come back out of the scan as a RangeError.
  for (const reference of ['&#x110000;', '&#99999999;', '&#xffffffff;']) {
    const markup = `<svg><rect fill="${reference}"/></svg>`;
    assert.deepEqual(findUnsafeSvg(markup), [], reference);
    assert.doesNotThrow(() => sanitizeSvgMarkup(markup), reference);
    assert.equal(errors(validateFacePart(variant({ artwork: `<g id="mouth-simple"><path id="mouth" d="M0 0" fill="${reference}"/></g>` }))).includes('artwork-unsafe'), false, reference);
  }
  // And one that is a character still decodes.
  assert.deepEqual(findUnsafeSvg('<svg><rect fill="&#x75;rl(https://evil.example/p)"/></svg>').map((item) => item.kind), ['external-reference']);
});
