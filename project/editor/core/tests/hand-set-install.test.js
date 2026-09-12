import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHandSetRegistry, normalizeHandSet } from '../hands/hand-set.js';
import {
  HAND_SETS_KEY, addHandGesture, gestureFromFile, gestureIdFromName, gestureReach,
  handSetFromFile, handSetPack, installHandSet, loadCustomGestures, removeHandGesture, saveCustomGestures
} from '../hands/hand-set-install.js';

/**
 * Adding a gesture, and importing a set (docs/HAND_STYLES.md).
 *
 * The promise the whole refit has to keep: **a ninth gesture is a ninth file**.
 * Nothing here names one of the shipped eight, because nothing in the path an
 * author walks should.
 */

const DIR = fileURLToPath(new URL('../../../assets/hands/defaultCartoon/', import.meta.url));
const manifest = JSON.parse(readFileSync(`${DIR}manifest.json`, 'utf8'));
const shipped = () => {
  const library = createHandSetRegistry();
  library.install(normalizeHandSet(manifest, Object.fromEntries(manifest.gestures
    .map((gesture) => [gesture.src, readFileSync(`${DIR}${gesture.src}`, 'utf8')]))));
  return library;
};

/** A drawing an author could have made in any editor, in the set's own frame. */
const drawing = (id = 'salute', name = 'Salute', d = 'M 80 100 L 120 100 L 120 140 L 80 140 Z') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"`
  + ` data-hand-pivot="100 100" data-hand-scale="2"><g id="hand-${id}" data-name="${name}">`
  + `<path id="palm" data-name="Palm" d="${d}" fill="#ffffff" stroke="#1b1b1b" stroke-width="3.8" />`
  + `<path id="thumb" data-name="Thumb" d="M 70 120 L 80 110 L 80 130 Z" fill="#ffffff" stroke="#1b1b1b" stroke-width="3.8" />`
  + `</g></svg>`;

const storage = () => { const kept = new Map(); return { getItem: (key) => kept.get(key) ?? null, setItem: (key, value) => kept.set(key, value), kept }; };

/* ── A gesture, out of a file ──────────────────────────────────────────────── */

test('a file names the gesture, its layers and the frame it was drawn in', () => {
  const gesture = gestureFromFile(drawing(), { library: shipped() });
  assert.equal(gesture.id, 'salute');
  assert.equal(gesture.label, 'Salute', 'the group says what the gesture is called');
  assert.deepEqual(gesture.roles, { palm: 'Palm', thumb: 'Thumb' }, 'and each layer what that part is called');
  assert.equal(gesture.origin, 'custom');
  assert.equal(gesture.mirrorable, true);
  // Read into the drawing's own units, through the frame the file declares:
  // 80 in a 200 box at 2x round a pivot of 100 is -10.
  assert.match(gesture.artwork, /d="M -10 0 L 10 0 L 10 20 L -10 20 Z"/);
  assert.equal(gestureFromFile('not an svg'), null);
});

test('a file that says nothing about its frame is read in the set it is joining', () => {
  const library = shipped();
  const bare = drawing().replace(/ data-hand-pivot="[^"]*"| data-hand-scale="[^"]*"/g, '');
  const gesture = gestureFromFile(bare, { library });
  // The set's own pivot and scale, which is what makes a drawing saved out of
  // a mascot and dropped back in work with nothing filled in.
  assert.match(gesture.artwork, /d="M -10 0 L 10 0 L 10 20 L -10 20 Z"/);
  assert.equal(gestureFromFile(bare, { library: createHandSetRegistry() }).artwork.includes('M 80 100'), true,
    'and with no set to join, the numbers are the file’s own');
});

test('a file is named by its name, the way an author names one', () => {
  assert.equal(gestureIdFromName('thumbs up.svg'), 'thumbsUp');
  assert.equal(gestureIdFromName('/tmp/Closed Side.SVG'), 'closedSide');
  assert.equal(gestureIdFromName('wave.svg'), 'wave');
  assert.equal(gestureIdFromName('123.svg'), '', 'a gesture id starts with a letter');
  assert.equal(gestureIdFromName(''), '');
});

/* ── A ninth gesture, with no code change ──────────────────────────────────── */

test('a ninth gesture is a ninth file, and it is in the library the moment it is added', () => {
  const library = shipped();
  const before = library.ids().length;
  const kept = storage();
  const result = addHandGesture(gestureFromFile(drawing(), { library }), { library, storage: kept });
  assert.equal(result.ok, true, result.reason);
  assert.equal(library.ids().length, before + 1);
  assert.equal(library.get('salute').label, 'Salute');
  // And it is kept, so the next session has it.
  const next = shipped();
  assert.deepEqual(loadCustomGestures(kept, next).map((gesture) => gesture.id), ['salute']);
  assert.equal(next.get('salute').label, 'Salute');
  assert.equal(next.get('salute').artwork, library.get('salute').artwork, 'and it is the same drawing, not one read through a frame twice');
});

test('a gesture the set already draws is not replaced by accident', () => {
  const library = shipped();
  const taken = gestureFromFile(drawing(manifest.gestures[0].id, 'Mine'), { library });
  const refused = addHandGesture(taken, { library });
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /already in the set/);
  assert.equal(library.get(manifest.gestures[0].id).origin, 'builtin', 'and the set’s own is untouched');
  // Asked for outright, it wins -- which is how an author replaces a drawing.
  assert.equal(addHandGesture(taken, { library, replace: true }).ok, true);
  assert.equal(library.get(manifest.gestures[0].id).label, 'Mine');
});

test('a drawing at another size is refused rather than quietly resized', () => {
  const library = shipped();
  // Twice the set's reach: a hand wearing it would change size when it changed
  // gesture, which is the one thing a set is for preventing.
  const huge = gestureFromFile(drawing('huge', 'Huge', 'M -100 -100 L 300 -100 L 300 300 L -100 300 Z'), { library });
  assert.ok(gestureReach(huge) > library.info.radius);
  const result = addHandGesture(huge, { library });
  assert.equal(result.ok, false);
  assert.match(result.reason, /would change size when it changed gesture/);
  assert.equal(library.has('huge'), false);
});

test('a drawing that breaks the rules is refused with the rule it broke', () => {
  const library = shipped();
  const nameless = drawing().replace(' id="thumb" data-name="Thumb"', '');
  const result = addHandGesture(gestureFromFile(nameless, { library }), { library });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === 'layer-id-missing'), JSON.stringify(result.issues));
  assert.equal(library.has('salute'), false, 'and nothing of it stays');
});

test('a gesture an author added can be forgotten; one the set draws cannot', () => {
  const library = shipped();
  const kept = storage();
  addHandGesture(gestureFromFile(drawing(), { library }), { library, storage: kept });
  assert.equal(removeHandGesture('salute', { library, storage: kept }).ok, true);
  assert.equal(library.has('salute'), false);
  assert.deepEqual(JSON.parse(kept.getItem(HAND_SETS_KEY)), []);
  const own = removeHandGesture(manifest.gestures[0].id, { library });
  assert.equal(own.ok, false);
  assert.match(own.reason, /came with the set/);
  assert.equal(removeHandGesture('nonsense', { library }).ok, false);
});

/* ── A whole set, imported ─────────────────────────────────────────────────── */

test('a set travels as one file, and installs all of it or none of it', () => {
  const library = shipped();
  const pack = {
    format: 'boop-hand-set', version: 1, set: 'mine', name: 'My hands', look: 'glove',
    viewBox: '0 0 200 200', pivot: [100, 100], scale: 2, radius: 40, defaultScale: 1, fallback: 'salute',
    gestures: [
      { id: 'salute', label: 'Salute', src: 'salute.svg', artwork: drawing(), roles: { palm: 'Palm', thumb: 'Thumb' } },
      { id: 'clasp', label: 'Clasp', src: 'clasp.svg', artwork: drawing('clasp', 'Clasp'), roles: { palm: 'Palm', thumb: 'Thumb' } }
    ]
  };
  const result = installHandSet(handSetFromFile(JSON.stringify(pack)), { library });
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(library.ids(), ['salute', 'clasp'], 'the set in use is the set that arrived');
  assert.equal(library.info.set, 'mine');
  assert.equal(library.info.radius, 40);

  // A set with one bad gesture in it installs nothing, and what was there stays.
  const broken = structuredClone(pack);
  broken.gestures[1].artwork = '<svg><g id="hand-clasp"><path d="M 0 0 A 1 1 0 0 1 2 2"/></g></svg>';
  const refused = installHandSet(handSetFromFile(JSON.stringify(broken)), { library });
  assert.equal(refused.ok, false);
  assert.ok(refused.issues.some((issue) => issue.code === 'artwork-path-commands' || issue.code === 'layer-id-missing'), JSON.stringify(refused.issues));
  assert.deepEqual(library.ids(), ['salute', 'clasp'], 'and the library is what it was');
  assert.equal(handSetFromFile('not json'), null);
});

test("an imported set does not take away the gestures an author drew", () => {
  const library = shipped();
  const kept = storage();
  addHandGesture(gestureFromFile(drawing(), { library }), { library, storage: kept });
  const pack = handSetPack(shipped());
  pack.set = 'other';
  pack.name = 'Another set';
  const result = installHandSet(handSetFromFile(JSON.stringify(pack)), { library, storage: kept });
  assert.equal(result.ok, true, result.reason);
  assert.equal(library.info.set, 'other', 'the set in use is the one that arrived');
  assert.equal(library.has('salute'), true, "and the author's own gesture came back with it");
  assert.equal(library.get('salute').origin, 'custom');
});

test('the library goes back out as a file, and comes back in unchanged', () => {
  const library = shipped();
  addHandGesture(gestureFromFile(drawing(), { library }), { library });
  const pack = handSetPack(library);
  assert.equal(pack.format, 'boop-hand-set');
  assert.deepEqual(pack.gestures.map((gesture) => gesture.id), library.ids());

  const round = createHandSetRegistry();
  assert.equal(installHandSet(handSetFromFile(JSON.stringify(pack)), { library: round }).ok, true);
  assert.deepEqual(round.ids(), library.ids());
  // Byte for byte: a round trip through a file must not read a drawing through
  // the file's frame a second time and shrink it.
  for (const id of library.ids()) assert.equal(round.get(id).artwork, library.get(id).artwork, `${id} survives the round trip`);
  assert.equal(round.info.radius, library.info.radius);
  assert.equal(round.info.fallback, library.info.fallback);
});

test("a name the runtime reads as an older name for something else is refused at the door", () => {
  // `wave` is an alias for `open` in the standalone runtime's vocabulary, and
  // `grab` for `fist`. A mascot published with a gesture called `wave` would
  // have it silently renamed on the page it is published to, so the clash is
  // named here rather than left to be mysterious later.
  const library = shipped();
  const result = addHandGesture(gestureFromFile(drawing('wave', 'Wave'), { library }), { library });
  assert.equal(result.ok, false);
  assert.match(result.reason, /older name for the open gesture/);
  assert.equal(library.has('wave'), false);
  assert.match(addHandGesture(gestureFromFile(drawing('grab', 'Grab'), { library }), { library }).reason, /older name for the fist gesture/);
  // A name nobody else uses is nobody else's.
  assert.equal(addHandGesture(gestureFromFile(drawing('salute', 'Salute'), { library }), { library }).ok, true);
});

test('storage that refuses is a gesture added and not kept, never a crash', () => {
  const library = shipped();
  const refuses = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
  assert.equal(addHandGesture(gestureFromFile(drawing(), { library }), { library, storage: refuses }).ok, true);
  assert.equal(library.has('salute'), true);
  assert.equal(saveCustomGestures(refuses, library), false);
  assert.deepEqual(loadCustomGestures(refuses, createHandSetRegistry()), []);
});
