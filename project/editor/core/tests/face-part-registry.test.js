import test from 'node:test';
import assert from 'node:assert/strict';
import { FACE_PART_LIBRARY, FacePartError, createFacePartRegistry, registerAccessory, registerFacePart } from '../face-library/face-part-registry.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { MOUTH_LINE } from './fixtures/mouth-line.js';
import { MOUTH_FULL } from '../face-library/builtin/mouth-full.js';
import { FACE_PART_CATEGORY_IDS } from '../face-library/face-part-model.js';
import { FACE_ARTBOARD } from '../sample/templates/face-artwork.js';

/**
 * The library (docs/FACE_PART_LIBRARY.md): validated, frozen assets by id,
 * with the categories over them, and a door for packs to register through.
 */
const glasses = { id: 'accessory.round-glasses', name: 'Round glasses', artwork: '<g id="glasses"><circle id="frame" cx="0" cy="0" r="1"/></g>', roles: { element: 'frame' }, referenceBox: { x: 0, y: 0, width: 2, height: 2 } };

test('the editor\'s library ships the built-in assets, frozen and by category', () => {
  assert.equal(FACE_PART_LIBRARY.size, BUILTIN_FACE_PARTS.length);
  assert.deepEqual(FACE_PART_LIBRARY.list().map((asset) => asset.id), ['head.round', 'head.oval', 'head.wide', 'head.narrow', 'head.square-soft', 'head.pear', 'head.chin', 'head.heart', 'eyes.dot', 'eyes.simple', 'eyes.iris', 'eyebrows.thin', 'eyebrows.normal', 'eyebrows.thick', 'eyebrows.flat', 'eyebrows.expressive', 'nose.dot', 'nose.hook', 'nose.soft', 'nose.cartoon', 'mouth.full', 'ears.round', 'ears.large', 'ears.small', 'hair.short', 'hair.spiky', 'hair.curly', 'hair.long', 'hair.balding', 'hair.bald', 'facialhair.moustache', 'facialhair.large-moustache', 'facialhair.goatee', 'facialhair.beard', 'facialhair.sideburns', 'accessory.glasses', 'accessory.square-glasses', 'accessory.hat', 'accessory.earring', 'accessory.earring-right', 'accessory.bow-tie',
    // The Soft Cartoon animal pack (MASC-10B), registered behind them all and
    // listed in the order it is reviewed in, not by category. It brings **no
    // eyes**: its six were the shipped construction at other radii, which its
    // own header said out loud, and the three builds serve a muzzle exactly as
    // they serve a face (docs/EYE_BUILDS.md).
    'head.animal-round', 'head.animal-narrow', 'head.animal-wide', 'head.animal-square', 'head.animal-small', 'head.animal-chubby', 'eyebrows.animal-thin-soft', 'eyebrows.animal-firm', 'eyebrows.animal-thick', 'eyebrows.animal-friendly-raised', 'eyebrows.animal-worried', 'ears.cat-pointed', 'ears.fox-large-pointed', 'ears.wolf-pointed', 'ears.dog-folded', 'ears.bear-round', 'ears.rabbit-long', 'ears.small-round', 'ears.tufted', 'accessory.muzzle-feline-short', 'accessory.muzzle-feline-rounded', 'accessory.muzzle-canine-medium', 'accessory.muzzle-canine-narrow', 'accessory.muzzle-bear-broad', 'accessory.muzzle-rodent-small', 'nose.triangle-small', 'nose.bear-broad', 'nose.button-tiny', 'nose.oval-soft', 'nose.animal-rounded', 'mouth.animal-smile', 'mouth.animal-neutral', 'mouth.animal-open-friendly', 'mouth.animal-small-smile', 'mouth.animal-happy-curve', 'accessory.whiskers-three-straight', 'accessory.whiskers-two-soft', 'accessory.whiskers-long-curved', 'accessory.whiskers-subtle-short',
    // The Soft Cartoon robot pack (MASC-11B), behind it, in its own review order.
    'head.robot-screen-rounded', 'head.robot-retro-square', 'head.robot-industrial-plate', 'head.robot-toy-round', 'ears.robot-screen-round', 'ears.robot-retro-round', 'ears.robot-industrial-bolt', 'ears.robot-toy-colorful', 'eyes.robot-display-friendly', 'eyes.robot-retro-led', 'eyes.robot-industrial-led', 'eyes.robot-toy-expressive', 'eyebrows.robot-screen-simple', 'eyebrows.robot-retro-plate', 'eyebrows.robot-industrial-visor', 'eyebrows.robot-toy-cute', 'mouth.robot-display', 'mouth.robot-retro-grille', 'mouth.robot-industrial-vent', 'mouth.robot-toy-simple', 'accessory.antenna-single-short', 'accessory.antenna-retro-multi', 'accessory.antenna-industrial-robust', 'accessory.antenna-toy-fun', 'accessory.panels-light-panel', 'accessory.panels-retro-buttons', 'accessory.panels-warning-stripe', 'accessory.panels-toy-buttons',
    // The Soft Cartoon bird pack (MASC-12B), behind them, in its own review order — and no eyes either, for the same reason.
    'head.bird-owl', 'head.bird-duck', 'head.bird-parrot', 'head.bird-crow', 'head.bird-cute', 'head.bird-slim', 'eyebrows.bird-angry', 'eyebrows.bird-curious', 'eyebrows.bird-relaxed', 'eyebrows.bird-happy', 'eyebrows.bird-sharp', 'mouth.beak-owl', 'mouth.beak-duck', 'mouth.beak-parrot', 'mouth.beak-crow', 'mouth.beak-small', 'mouth.beak-wide', 'accessory.crest-owl-tufts', 'accessory.crest-simple', 'accessory.crest-messy-tuft', 'accessory.crest-smooth-feather', 'accessory.crest-parrot-tall', 'accessory.crest-round-tuft', 'accessory.monocle']);
  assert.deepEqual(FACE_PART_LIBRARY.list('mouth').map((asset) => asset.id), ['mouth.full', 'mouth.animal-smile', 'mouth.animal-neutral', 'mouth.animal-open-friendly', 'mouth.animal-small-smile', 'mouth.animal-happy-curve', 'mouth.robot-display', 'mouth.robot-retro-grille', 'mouth.robot-industrial-vent', 'mouth.robot-toy-simple', 'mouth.beak-owl', 'mouth.beak-duck', 'mouth.beak-parrot', 'mouth.beak-crow', 'mouth.beak-small', 'mouth.beak-wide']);
  assert.deepEqual(FACE_PART_LIBRARY.list('pupils'), [], 'the pupils come with the eyes');
  assert.equal(FACE_PART_LIBRARY.get('nose.dot').origin, 'builtin');
  assert.ok(Object.isFrozen(FACE_PART_LIBRARY.get('nose.dot')));
  assert.equal(FACE_PART_LIBRARY.get('nope'), null);
  const categories = FACE_PART_LIBRARY.categories();
  assert.deepEqual(categories.map((category) => category.id), [...FACE_PART_CATEGORY_IDS]);
  assert.deepEqual(Object.fromEntries(categories.map((category) => [category.id, category.count])), { head: 24, eyes: 7, pupils: 0, eyelids: 0, eyebrows: 19, nose: 9, mouth: 16, ears: 15, hair: 6, facialHair: 5, accessory: 31 });
});

test('an asset claims the colours it paints, and no others', () => {
  // `palette` is documented as the tokens the artwork uses, and is derived
  // from `paletteRoles` when an asset leaves it out. Three factories used to
  // hard-code their whole *category*'s list instead -- so a pair of glasses
  // drawn in one colour claimed two, and a bald head claimed hair it does not
  // have. Nothing read the field, which is exactly why it drifted.
  for (const asset of FACE_PART_LIBRARY.list()) {
    const painted = new Set();
    for (const roles of Object.values(asset.paletteRoles)) for (const token of Object.values(roles)) painted.add(token);
    assert.deepEqual([...asset.palette].sort(), [...painted].sort(), `${asset.id} claims a colour it never paints`);
  }
});

test('a registry validates on the way in and refuses with the issues attached', () => {
  const registry = createFacePartRegistry();
  const asset = registry.register(MOUTH_LINE);
  assert.equal(asset.id, 'mouth.line');
  assert.equal(registry.has('mouth.line'), true);
  assert.throws(() => registry.register(MOUTH_LINE), (error) => error instanceof FacePartError && error.issues.some((item) => item.code === 'id-taken') && /already registered/.test(error.message));
  assert.throws(() => registry.register({ ...MOUTH_LINE, id: 'mouth.broken', artwork: '<g id="x"><script/></g>' }), (error) => error.name === 'FacePartError' && error.issues.map((item) => item.code).includes('artwork-unsafe'));
  assert.equal(registry.size, 1, 'a refused asset leaves nothing behind');
  assert.equal(registry.validate({}).ok, false, 'and can be asked without registering');
  assert.equal(registry.remove('mouth.line'), true);
  assert.equal(registry.remove('mouth.line'), false);
  assert.equal(registry.size, 0);
});

test('a pack registers all of its assets or none of them', () => {
  const registry = createFacePartRegistry();
  assert.throws(() => registry.registerMany([MOUTH_LINE, { ...MOUTH_LINE, id: 'mouth.dup', name: '' }]), /name/);
  assert.equal(registry.size, 0, 'the good one was not kept');
  assert.throws(() => registry.registerMany([MOUTH_LINE, MOUTH_LINE]), /appears twice/);
  assert.equal(registry.size, 0);
  const registered = registry.registerMany(BUILTIN_FACE_PARTS);
  assert.equal(registered.length, BUILTIN_FACE_PARTS.length);
  assert.equal(registry.size, BUILTIN_FACE_PARTS.length);
});

test('a module outside the editor registers into the shared library, and an accessory is one of its parts', () => {
  const before = FACE_PART_LIBRARY.size;
  const asset = registerAccessory(glasses);
  assert.equal(asset.category, 'accessory');
  assert.equal(asset.mountPoint, 'head.center', 'the category\'s default mount point');
  assert.equal(FACE_PART_LIBRARY.size, before + 1);
  assert.deepEqual(FACE_PART_LIBRARY.list('accessory').map((item) => item.id), ['accessory.glasses', 'accessory.square-glasses', 'accessory.hat', 'accessory.earring', 'accessory.earring-right', 'accessory.bow-tie', 'accessory.muzzle-feline-short', 'accessory.muzzle-feline-rounded', 'accessory.muzzle-canine-medium', 'accessory.muzzle-canine-narrow', 'accessory.muzzle-bear-broad', 'accessory.muzzle-rodent-small', 'accessory.whiskers-three-straight', 'accessory.whiskers-two-soft', 'accessory.whiskers-long-curved', 'accessory.whiskers-subtle-short', 'accessory.antenna-single-short', 'accessory.antenna-retro-multi', 'accessory.antenna-industrial-robust', 'accessory.antenna-toy-fun', 'accessory.panels-light-panel', 'accessory.panels-retro-buttons', 'accessory.panels-warning-stripe', 'accessory.panels-toy-buttons', 'accessory.crest-owl-tufts', 'accessory.crest-simple', 'accessory.crest-messy-tuft', 'accessory.crest-smooth-feather', 'accessory.crest-parrot-tall', 'accessory.crest-round-tuft', 'accessory.monocle', 'accessory.round-glasses'], 'after the built-in ones');
  assert.throws(() => registerFacePart(glasses), FacePartError, 'no category, and the id is taken');
  assert.equal(FACE_PART_LIBRARY.size, before + 1);
  FACE_PART_LIBRARY.remove('accessory.round-glasses');
  assert.equal(FACE_PART_LIBRARY.size, before);
});

/**
 * The style axis (docs/FACE_PART_LIBRARY.md, "The style axis"; roadmap
 * V3-05). A drawing that restyles another is held like any other -- `get`
 * finds it, an install puts it on, the animation matrix drives it -- and is
 * reached through the drawing it restyles, so a restyle of every part for
 * every preset is drawings, never cards.
 */
test('a drawing that restyles another is in the library and not in the category\'s cards', () => {
  const registry = createFacePartRegistry();
  registry.registerMany(BUILTIN_FACE_PARTS);
  const workshop = { ...MOUTH_FULL, id: 'mouth.full-workshop', name: 'Simple, in the workshop style', artwork: MOUTH_FULL.artwork.replace('id="mouth-full"', 'id="mouth-full-workshop"'), variant: { of: 'mouth.full', style: 'workshop' } };
  registry.register(workshop);
  assert.equal(registry.size, BUILTIN_FACE_PARTS.length + 1);
  assert.equal(registry.get('mouth.full-workshop').name, 'Simple, in the workshop style', 'the library holds it');
  assert.deepEqual(registry.list('mouth').map((asset) => asset.id), ['mouth.full', 'mouth.animal-smile', 'mouth.animal-neutral', 'mouth.animal-open-friendly', 'mouth.animal-small-smile', 'mouth.animal-happy-curve', 'mouth.robot-display', 'mouth.robot-retro-grille', 'mouth.robot-industrial-vent', 'mouth.robot-toy-simple', 'mouth.beak-owl', 'mouth.beak-duck', 'mouth.beak-parrot', 'mouth.beak-crow', 'mouth.beak-small', 'mouth.beak-wide', 'mouth.full-workshop'], 'everything the library holds');
  assert.deepEqual(registry.cards('mouth').map((asset) => asset.id), ['mouth.full', 'mouth.animal-smile', 'mouth.animal-neutral', 'mouth.animal-open-friendly', 'mouth.animal-small-smile', 'mouth.animal-happy-curve', 'mouth.robot-display', 'mouth.robot-retro-grille', 'mouth.robot-industrial-vent', 'mouth.robot-toy-simple', 'mouth.beak-owl', 'mouth.beak-duck', 'mouth.beak-parrot', 'mouth.beak-crow', 'mouth.beak-small', 'mouth.beak-wide'], 'and not a card of its own');
  assert.equal(registry.cards().length, registry.size - 1);
  // Reached through the drawing it restyles, by name.
  assert.equal(registry.variant('mouth.full', 'workshop').id, 'mouth.full-workshop');
  assert.equal(registry.variant('mouth.full', 'night'), null, 'a style nobody has drawn yet');
  assert.equal(registry.variant('mouth.beak-owl', 'workshop'), null);
  assert.equal(registry.variant('mouth.full', ''), null);
  assert.deepEqual(registry.variantsOf('mouth.full').map((asset) => asset.id), ['mouth.full-workshop']);
  assert.deepEqual(registry.variantsOf('mouth.beak-owl'), []);
  // A second drawing cannot answer for the same style of the same part.
  assert.throws(() => registry.register({ ...workshop, id: 'mouth.full-shed' }), (error) => error.issues.some((issue) => issue.code === 'variant-taken'));
  registry.remove('mouth.full-workshop');
  assert.equal(registry.variant('mouth.full', 'workshop'), null, 'forgotten, and the style with it');
});

test('a pack may write a style down before the drawing it restyles, and is taken in as one', () => {
  const registry = createFacePartRegistry();
  const simple = { ...MOUTH_LINE };
  const workshop = { ...MOUTH_LINE, id: 'mouth.line-workshop', name: 'Workshop', artwork: MOUTH_LINE.artwork.replace('id="mouth-line"', 'id="mouth-line-workshop"'), variant: { of: 'mouth.line', style: 'workshop' } };
  registry.registerMany([workshop, simple]);
  assert.equal(registry.variant('mouth.line', 'workshop').id, 'mouth.line-workshop', 'checked against the rest of the batch, not against the order it is in');
  const other = createFacePartRegistry();
  assert.throws(() => other.registerMany([workshop]), (error) => error.issues.some((issue) => issue.code === 'variant-unknown'), 'and a style of a drawing nobody ships is refused');
  assert.equal(other.size, 0);
  assert.throws(() => other.registerMany([simple, workshop, { ...workshop, id: 'mouth.line-shed' }]), (error) => error.issues.some((issue) => issue.code === 'variant-taken'), 'two answers for one style, in one pack');
  assert.equal(other.size, 0);
});

/**
 * The canvas clips to the artboard, so a drawing whose reference box leaves it
 * is a drawing the author sees cut off — and the frame these are drawn in is
 * the template's own (`FACE_ARTBOARD`), read from there rather than written
 * down again here. It has headroom above the face on purpose: a top hat's
 * crown stands 78 units over a head whose top sits at y 22, and a hat that had
 * to be flattened to fit the page was the page being wrong, not the hat.
 *
 * The fit moves an asset onto whatever face it lands on, but the box is what
 * the fit measures from and the template is the frame it is drawn in, so a box
 * that does not fit is wrong at the source rather than at the destination.
 */
test('every built-in drawing fits inside the artboard it is drawn in', () => {
  const edge = { left: FACE_ARTBOARD.x, top: FACE_ARTBOARD.y, right: FACE_ARTBOARD.x + FACE_ARTBOARD.width, bottom: FACE_ARTBOARD.y + FACE_ARTBOARD.height };
  const outside = BUILTIN_FACE_PARTS.flatMap((asset) => {
    const box = asset.referenceBox || {};
    const over = [];
    if (box.x < edge.left) over.push(`left by ${edge.left - box.x}`);
    if (box.y < edge.top) over.push(`top by ${edge.top - box.y}`);
    if (box.x + box.width > edge.right) over.push(`right by ${box.x + box.width - edge.right}`);
    if (box.y + box.height > edge.bottom) over.push(`bottom by ${box.y + box.height - edge.bottom}`);
    return over.length ? [`${asset.id}: ${over.join(', ')}`] : [];
  });
  assert.deepEqual(outside, [], 'these drawings would be clipped on the canvas');
});

/**
 * A shut eye shows **no eye**, and a lid never shows past one.
 *
 * The lids are drawn open and the asset says how each one closes
 * (`parts.eyelids.drivers.eyeOpen`), so the drawing and the movement are two
 * halves of one claim and only measuring them together can check it.
 *
 * The claim used to be that two sliding lids *met* on a seam, and it was
 * measured on their paths. It was also wrong twice over: the travel carried
 * each lid's own curved edge a second time -- the drawing had already placed it
 * -- so on the round eyes the upper arrived sixteen units below the middle and
 * the lower fourteen above, thirty units of lid through lid on a socket
 * forty-five tall. And it took a socket to hide the overshoot, which is the
 * mask an author could neither see nor move.
 *
 * A lid now **grows**: it is the eye's own ellipse squashed to a sliver on the
 * rim it swings from, scaled about that rim until it covers the eye
 * (docs/EYE_BUILDS.md). The arithmetic is exact and there is nothing to clip, so
 * the two things worth measuring are that a lid is *as drawn* with the eye open
 * and that it lands on the far rim with it shut. Short of the rim leaves an eye
 * looking through its own eyelid; past it shows skin on the cheek.
 */
const lidReach = (asset, role) => {
  const driver = asset.parts.eyelids.drivers.eyeOpen;
  const hint = driver.roles?.[role] || driver;
  // `amplitude * eyeOpen + offset`, and `eyeOpen` rests at 1 and shuts at 0.
  return { open: hint.amplitude + hint.offset, shut: hint.offset };
};

/**
 * One lid's leading edge as drawn: where its ends sit, and where its middle
 * does.
 *
 * The path is `M · L · L · C · C · Z` (`eyeLidPath`, docs/EYE_BUILDS.md): a
 * flat run along the rim, a vertical side, and the edge back in two cubics.
 * The rim is the point a blink scales the lid about, so what each number
 * reaches when the eye shuts is `rim + (value - rim) * scale`.
 */
const lidDrawn = (asset, side, which) => {
  const id = `lid${which}${side[0].toUpperCase()}${side.slice(1)}`;
  const found = new RegExp(`id="${id}"[^>]*d="([^"]+)"`).exec(asset.artwork);
  if (!found) return null;
  const v = found[1].match(/-?[\d.]+/g).map(Number);
  return { rim: v[1], end: v[5], mid: v[11] };
};

/**
 * A shutter's leading edge, walked rather than solved.
 *
 * `M l back L r back L r edge Q cx control l edge Z`: the edge is the quadratic,
 * sampled at 257 steps -- finer than any difference that would show on a face.
 */
const lidEdge = (d) => {
  const [, , , , right, edge, cx, control, left] = d.match(/-?[\d.]+/g).map(Number);
  const points = Array.from({ length: 257 }, (unused, step) => {
    const at = step / 256, u = 1 - at;
    return { x: u * u * right + 2 * u * at * cx + at * at * left, y: u * u * edge + 2 * u * at * control + at * at * edge };
  });
  return (x) => points.reduce((best, point) => (Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best)).y;
};

test('a robot\'s shutters meet on one line and neither goes through the other', () => {
  const shutters = BUILTIN_FACE_PARTS.filter((asset) => asset.parts?.eyelids?.drivers?.eyeOpen?.property === 'translateY');
  assert.ok(shutters.length, 'the robots close by sliding');
  for (const asset of shutters) {
    const driver = asset.parts.eyelids.drivers.eyeOpen;
    const shut = (role) => (role.endsWith('Lower') ? driver.roles[role] : driver).offset;
    const path = (id) => asset.artwork.match(new RegExp(`id="${id}"[^>]*d="([^"]+)"`))[1];
    for (const side of ['Left', 'Right']) {
      const upper = lidEdge(path(`lidUpper${side}`)), lower = lidEdge(path(`lidLower${side}`));
      const up = shut(`${side.toLowerCase()}Upper`), down = shut(`${side.toLowerCase()}Lower`);
      const { x, width } = asset.referenceBox;
      let met = false;
      for (let at = x; at <= x + width; at += 0.5) {
        const over = (upper(at) + up) - (lower(at) + down);
        assert.ok(over <= 1e-6, `${asset.id} ${side}: the shutters cross by ${over} at x ${at}`);
        if (over > -1e-6) met = true;
      }
      assert.ok(met, `${asset.id} ${side}: the shutters never meet, so a closed eye is left open`);
    }
  }
});

test('a shut eye shows no eye, and an open one shows the lids exactly as drawn', () => {
  const lidded = BUILTIN_FACE_PARTS.filter((asset) => asset.parts?.eyelids?.drivers?.eyeOpen);
  assert.ok(lidded.length, 'the library draws eyes with lids');
  // A build with no lids at all is the dot: nothing to close *with*, so the
  // pupil itself flattens onto the line it closes to.
  assert.deepEqual(BUILTIN_FACE_PARTS.filter((asset) => asset.parts?.eyelids && !asset.parts.eyelids.drivers?.eyeOpen).map((asset) => asset.id),
    ['eyes.dot'], 'and that is the only eye in the library that closes without a lid');
  // A **shutter** is the other construction, and the robots are the only eyes
  // that have one: a panel that slides over a lit element, in a housing that is
  // part of the drawing rather than a mask hiding what is parked outside it
  // (`builtin/robots/eyes.js`). It closes by `translateY` and is measured below.
  const eyes = lidded.filter((asset) => asset.parts.eyelids.drivers.eyeOpen.property === 'scaleY');
  assert.deepEqual(lidded.filter((asset) => !eyes.includes(asset)).map((asset) => asset.id),
    ['eyes.robot-display-friendly', 'eyes.robot-retro-led', 'eyes.robot-industrial-led', 'eyes.robot-toy-expressive'],
    'and a shutter is a robot\'s, nobody else\'s');

  for (const asset of eyes) {
    // The eye's own half-height, and where its middle is.
    const ry = asset.referenceBox.height / 2, cy = asset.referenceBox.y + ry;
    for (const side of ['left', 'right']) {
      const landed = {};
      for (const which of ['Upper', 'Lower']) {
        const role = `${side}${which}`;
        const { open, shut } = lidReach(asset, role);
        const drawn = lidDrawn(asset, side, which);
        assert.ok(drawn, `${asset.id} ${role}: drawn as a lid path on the rim`);
        assert.equal(open, 1, `${asset.id} ${role}: open, the lid is exactly as drawn`);
        // Scaled about the rim it hangs from, so this is where each part of the
        // edge lands when the eye is shut.
        const grown = (value) => drawn.rim + (value - drawn.rim) * shut;
        landed[which] = { end: grown(drawn.end), mid: grown(drawn.mid) };
        // The ends land on the eye's own widest points. That is the whole
        // reason the edge is drawn with its ends a shade short of its middle:
        // two edges that bulge towards each other meet in the middle and leave
        // a white wedge at each corner, which no amount of bulge ever closes.
        assert.ok(Math.abs(landed[which].end - cy) <= 0.6,
          `${asset.id} ${role}: its ends land at ${landed[which].end.toFixed(2)}, not on the eye's own middle line ${cy.toFixed(2)}`);
      }
      // And the two edges arrive on **one curve**, which is what a shut eye is:
      // a seam, with no eye left showing anywhere along it.
      assert.ok(Math.abs(landed.Upper.mid - landed.Lower.mid) <= 0.3,
        `${asset.id} ${side}: the two lids meet at ${landed.Upper.mid.toFixed(2)} and ${landed.Lower.mid.toFixed(2)} instead of on one seam`);
      assert.ok(landed.Upper.mid > cy && landed.Upper.mid < cy + ry * 0.2,
        `${asset.id} ${side}: the seam sits at ${landed.Upper.mid.toFixed(2)}, which is not a shade below the eye's middle`);
    }
    // And the socket is the shape an author can see: one `<use>` of the white,
    // never a second copy of it that could drift (docs/EYE_BUILDS.md).
    for (const side of ['Left', 'Right']) {
      assert.ok(asset.artwork.includes(`<clipPath id="eyeSocket${side}"><use href="#eyeWhite${side}" /></clipPath>`), `${asset.id}: ${side} socket is the white itself`);
      assert.ok(asset.artwork.includes(`<g id="eyeInner${side}" data-name="${side} eye, inside" clip-path="url(#eyeSocket${side})">`), `${asset.id}: ${side} inside is cut by it`);
      // The pupil is in the cut too. A gaze carries it across the white and
      // nothing else stops it at the rim -- on the iris build the iris is
      // wider still, and left the eye outright.
      assert.match(asset.artwork, new RegExp(`<g id="eyeInner${side}"[^>]*>(?:(?!</g>)[\\s\\S])*id="pupil${side}"`), `${asset.id}: ${side} pupil is cut by it`);
    }
  }
});
