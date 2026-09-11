import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createFakeFaceCanvas, boxesFromReferenceBox, templateBoxes } from './helpers/fake-face-canvas.js';
import { createFacePartCommands } from '../face-library/face-part-commands.js';
import { createFacePartRegistry } from '../face-library/face-part-registry.js';
import { BUILTIN_FACE_PARTS } from '../face-library/builtin/index.js';
import { artworkIds, facePartCategory } from '../face-library/face-part-model.js';
import { HEAD_TURN_LAYERS, headTurnElements, normalizeHeadTurnProfile } from '../head-pose/head-pose-turn.js';
import { BUILTIN_HEAD_TURNS, TEMPLATE_HEAD_TURN, headTurnWord } from './fixtures/head-turn-baseline.js';

/**
 * Who takes part in the 2.5D turn, and on whose word (V3-01;
 * docs/HEAD_POSE_2_5D.md, "Which parts turn").
 *
 * The drawing is asked before the role table, because a role stopped being
 * enough to answer with as soon as several drawings shared one: every
 * accessory plays `element`, and a hat and a pair of glasses do not sit at the
 * same depth. What the table says is still what a drawing that says nothing
 * gets, which is every asset the library ships -- so the second half of this
 * file signs the turn each of them generates against the words captured before
 * any of this existed. A mechanism that re-proportions a tuned grid on its way
 * past is a look change nobody asked for.
 */

const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, bindings: {}, constraints: {} });

/** A head outline with one accessory drawn on it, and whatever each part says about turning. */
function face({ head = null, badge = null } = {}) {
  const said = (assetTurn) => (assetTurn ? { assetTurn } : {});
  return {
    elements: { face: element(), badge: element() },
    layers: [{ id: 'face', name: 'face', type: 'g', visible: true, children: [{ id: 'badge', name: 'badge', type: 'path', visible: true, children: [] }] }],
    semanticParts: {
      head: { id: 'head', type: 'head', roles: { head: 'face' }, ...said(head) },
      badge: { id: 'badge', type: 'accessory', roles: { element: 'badge' }, ...said(badge) }
    }
  };
}
const layerOf = (document, elementId) => headTurnElements(document).find((layer) => layer.elementId === elementId) || null;

test('the turn asks the drawing first, then the role table, then nobody', () => {
  // Nobody: an accessory says nothing, and no role table will ever hold an
  // answer for `element` -- it is the one role every accessory plays.
  assert.deepEqual(headTurnElements(face()).map((layer) => layer.role), ['head']);

  // The drawing: the same accessory, saying how it turns.
  const declared = layerOf(face({ badge: { element: { depth: 0.5, narrow: true } } }), 'badge');
  assert.ok(declared, 'an accessory that describes itself is in the turn');
  assert.equal(declared.narrow, true);
  assert.equal(declared.screenDepth, 0.68, 'the outline it is drawn inside, plus its own');

  // And the drawing wins over the table, whole: the outline here calls itself
  // a feature at depth 1, and the table's `squash` is not folded in underneath.
  const over = layerOf(face({ head: { head: { depth: 1 } } }), 'face');
  assert.equal(over.depth, 1);
  assert.equal(over.squash, undefined, 'a profile is an answer, not an amendment to one');

  // A profile that says nothing the turn can read is not an answer at all: it
  // falls through to the table rather than taking the part out of the turn.
  assert.equal(layerOf(face({ head: { head: { dpeth: 1 } } }), 'face').depth, HEAD_TURN_LAYERS.head.depth);
  assert.equal(layerOf(face({ badge: { element: {} } }), 'badge'), null);
});

test('every row of the role table is a profile an asset could have written itself', () => {
  for (const [role, layer] of Object.entries(HEAD_TURN_LAYERS)) assert.deepEqual(normalizeHeadTurnProfile(layer), layer, role);
  assert.equal(normalizeHeadTurnProfile(null), null);
  assert.equal(normalizeHeadTurnProfile('deep'), null);
  assert.equal(normalizeHeadTurnProfile({ tilt: 'a lot' }).tilt, NaN, 'kept as the nonsense it is, for validation to name');
  assert.deepEqual(normalizeHeadTurnProfile({ depth: '0.4', ear: 1, side: ' left ' }), { depth: 0.4, side: 'left', ear: true });
  assert.ok(Object.isFrozen(normalizeHeadTurnProfile({ depth: 1 })));
});

/* ── Nothing the library already generates may move ──────────────────────── */

function dress(assetId, { assets = BUILTIN_FACE_PARTS } = {}) {
  const store = createEditorStore(createTemplateProjectState());
  const library = createFacePartRegistry();
  library.registerMany(assets);
  const boxes = {};
  for (const asset of library.list()) Object.assign(boxes, boxesFromReferenceBox(asset, artworkIds(asset.artwork)));
  const canvas = createFakeFaceCanvas(store, { boxes: templateBoxes(), installed: (id) => boxes[id] || boxes[id.replace(/-\d+$/, '')] || null });
  const commands = createFacePartCommands(store, createHistory(store), canvas, { library });
  const summary = commands.replace(facePartCategory(library.get(assetId).category).id, assetId);
  assert.equal(summary.ok, true, `${assetId}: ${summary.reason}`);
  return { document: store.getDocument(), summary };
}

test('the template ships the turn the baseline was captured from', () => {
  assert.equal(headTurnWord(createTemplateProjectState().keyforms), TEMPLATE_HEAD_TURN);
});

for (const asset of BUILTIN_FACE_PARTS) {
  test(`${asset.id}: the turn it generates is the one it always generated`, () => {
    const { document } = dress(asset.id);
    assert.equal(headTurnWord(document.keyforms), BUILTIN_HEAD_TURNS[asset.id], `${asset.id} generates a different turn than the baseline`);
  });
}

/* ── The whole way through, on an asset written for it ───────────────────── */

/**
 * An accessory that says how it turns. It is a fixture and not a shipped
 * asset: putting the accessories in the turn is V3-02's to do, and V3-02's to
 * re-sign the baseline for.
 */
const BADGE = Object.freeze({
  id: 'accessory.turning-badge', category: 'accessory', name: 'Turning badge', origin: 'custom',
  artwork: '<g id="accessory-badge"><circle id="accessory" cx="120" cy="150" r="10" fill="#33424f" /></g>',
  roles: Object.freeze({ element: 'accessory' }),
  turn: Object.freeze({ element: Object.freeze({ depth: 0.7, side: null, narrow: true }) }),
  referenceBox: Object.freeze({ x: 110, y: 140, width: 20, height: 20 }),
  mountPoint: 'head.center'
});

test('an asset that declares a profile joins the turn on its own word', () => {
  const { document, summary } = dress(BADGE.id, { assets: [...BUILTIN_FACE_PARTS, BADGE] });
  const part = document.semanticParts[summary.partId];
  assert.deepEqual(part.assetTurn, { element: { depth: 0.7, side: null, narrow: true } }, 'the install records what the asset said');
  const layer = headTurnElements(document).find((item) => item.elementId === part.roles.element);
  assert.ok(layer, 'the accessory is in the turn, which the role table alone would never put it in');
  assert.equal(layer.narrow, true);
  assert.notEqual(headTurnWord(document.keyforms), TEMPLATE_HEAD_TURN, 'and the grid it regenerates says so');
});
