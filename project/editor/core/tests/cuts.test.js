// The cut, read out of the markup (docs/VECTOR_EDITING.md).
//
// « il y a une decoupe avec un autre element mais ca n'apparait nul part. on
//   devrais pouvoir gerer le cut et la gemotrie de coupe de facon simple mais
//   ca n'apparait nul part (ni dans les layers) »
//
// The fringe arrived cut to the head, and a `<clipPath>` is in no layer and no
// `elements` record -- so nothing in the editor could say so, and nothing could
// be pressed to reach the shape doing the cutting. This is the reader both the
// Layers panel and the canvas menu ask, which is why it takes markup and not a
// DOM: only one of them has one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CUT_ATTRIBUTES, describeCut, readCuts } from '../artwork/cuts.js';
import { buildMascotFaceSvg } from '../sample/templates/face-artwork.js';

test('a cut that points at a drawing names that drawing, both ways round', () => {
  const { byPiece, byCutter } = readCuts(`<svg>
    <path id="head" data-name="Head shape" d="M0 0 L10 0 L10 10 Z" />
    <clipPath id="headShape"><use href="#head" /></clipPath>
    <g id="hairFront" data-name="Hair front" clip-path="url(#headShape)"><path id="hair" d="M0 0" /></g>
    <path id="faceShading" data-name="Face shading" clip-path="url(#headShape)" d="M1 1" />
  </svg>`);
  assert.deepEqual(byPiece.hairFront, {
    clipId: 'headShape', kind: 'clipPath', shapeId: 'head', shapeName: 'Head shape',
    named: true, drawn: true, hidden: false
  });
  // Both ways round, because the head's own row has something to say too: an
  // author about to redraw or hide it should be told what rides on it.
  assert.deepEqual(byCutter.head, ['hairFront', 'faceShading']);
  assert.equal(byPiece.head, undefined, 'the shape that cuts is not itself cut');
});

test('a cut that owns its shape is the one an author cannot reach', () => {
  // What the Cut tool makes: the shape leaves the drawing and becomes a frozen
  // copy inside the definitions. There is no id to go to and no row to press,
  // and the editor says so rather than naming an id that leads nowhere.
  const { byPiece, byCutter } = readCuts(`<svg><defs>
      <clipPath id="cut-1"><path d="M0 0 L9 9" /></clipPath>
    </defs><rect id="band" clip-path="url(#cut-1)" /></svg>`);
  assert.equal(byPiece.band.named, false);
  assert.equal(byPiece.band.shapeId, null);
  assert.equal(byPiece.band.drawn, false);
  assert.deepEqual(byCutter, {}, 'nothing points back at a shape with no id');
});

test('a hidden cutter is reported, because its pieces go with it', () => {
  // Measured in a browser: a `<use>` of a `display:none` drawing renders
  // nothing, so the clip keeps nothing and the fringe disappears whole. That is
  // the price of a cut that follows its shape, and an author who hides the head
  // has to be told why the hair went with it.
  const hidden = readCuts(`<svg>
    <path id="head" data-name="Head shape" display="none" d="M0 0" />
    <clipPath id="headShape"><use href="#head" /></clipPath>
    <g id="hairFront" clip-path="url(#headShape)" />
  </svg>`);
  assert.equal(hidden.byPiece.hairFront.hidden, true);
  // A frozen copy is never "hidden": it is not a drawing, so it has no state an
  // author could have put it in.
  const owned = readCuts(`<svg><clipPath id="c"><path id="s" display="none" d="M0 0" /></clipPath><rect id="r" clip-path="url(#c)" /></svg>`);
  assert.equal(owned.byPiece.r.hidden, false);
});

test('a picture cuts by its transparency, and that is a cut too', () => {
  const { byPiece } = readCuts(`<svg>
    <image id="stencil" data-name="Stencil" href="a.png" />
    <mask id="stencilMask" mask-type="alpha"><use href="#stencil" /></mask>
    <rect id="paint" mask="url(#stencilMask)" />
  </svg>`);
  assert.equal(byPiece.paint.kind, 'mask');
  assert.equal(byPiece.paint.shapeName, 'Stencil');
  assert.deepEqual([...CUT_ATTRIBUTES], ['clip-path', 'mask']);
});

test('a reference to nothing is not a cut', () => {
  // A clip whose definition was deleted leaves the attribute behind. Reporting
  // it would put a badge on a row with nothing behind it.
  const { byPiece } = readCuts('<svg><rect id="r" clip-path="url(#gone)" /><rect id="plain" /></svg>');
  assert.deepEqual(byPiece, {});
});

test('describeCut says it from the row\'s own point of view', () => {
  const cuts = readCuts(`<svg>
    <path id="head" data-name="Head shape" d="M0 0" />
    <clipPath id="headShape"><use href="#head" /></clipPath>
    <g id="hairFront" clip-path="url(#headShape)" />
    <g id="faceShading" clip-path="url(#headShape)" />
  </svg>`);
  const name = (id) => ({ hairFront: 'Hair front', faceShading: 'Face shading' })[id] || null;
  assert.equal(describeCut(cuts, 'hairFront', name).cutBy.shapeName, 'Head shape');
  assert.equal(describeCut(cuts, 'hairFront', name).cutting, null);
  assert.deepEqual(describeCut(cuts, 'head', name).cutting, ['Hair front', 'Face shading']);
  assert.equal(describeCut(cuts, 'head', name).cutBy, null);
  assert.deepEqual(describeCut(cuts, 'nobody', name), { cutBy: null, cutting: null });
  assert.deepEqual(describeCut(null, 'hairFront'), { cutBy: null, cutting: null });
});

test('every cut the template ships is one an author can reach', () => {
  // The regression this exists for. `headShape` was an anonymous copy of the
  // head in `<defs>`: it cut the fringe, it appeared in no layer, and because it
  // was a copy it did not follow the head's jaw either.
  const { byPiece, byCutter } = readCuts(buildMascotFaceSvg());
  assert.deepEqual(Object.keys(byPiece).sort(), ['eyeInnerLeft', 'eyeInnerRight', 'faceShading', 'hairFront']);
  for (const [id, cut] of Object.entries(byPiece)) {
    assert.equal(cut.named, true, `${id} is cut to a shape with no name`);
    assert.equal(cut.drawn, true, `${id} is cut to a frozen copy rather than to a drawing`);
    assert.equal(cut.hidden, false);
  }
  assert.equal(byPiece.hairFront.shapeId, 'head');
  assert.equal(byPiece.hairFront.shapeName, 'Head shape');
  assert.deepEqual(byCutter.head, ['faceShading', 'hairFront']);
  assert.deepEqual(byCutter.eyeWhiteLeft, ['eyeInnerLeft']);
});
