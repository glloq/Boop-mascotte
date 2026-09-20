/**
 * What the Face states panel shows, as data (docs/FACE_SVG_STATES.md).
 *
 * Pure: it reads the document and the live parameter values and reports the
 * eyes' states, the mouth's expressions and visemes, and the correctives each
 * of them reaches. The panel renders this and owns no knowledge of its own,
 * which is what lets the whole surface be tested without a DOM.
 *
 * There is deliberately no *state* in here beyond what the project holds. A
 * state is a set of control values; whether one is "on" is a question about
 * the live face, answered by comparing numbers, exactly as the pose chips
 * already answer it (`core/puppet/part-poses.js`).
 */
import { EYE_POSE_PRESETS, VISEME_PRESETS, eyePoseValues, resolveEyePose, resolveViseme, visemeExpressionId } from './face-states.js';
import {
  correctiveSlotsFor, faceCorrectiveId, faceCorrectiveWeight, faceCorrectives,
  activeCorrectiveSlots, correctiveExpression, findFaceCorrective
} from './face-correctives.js';
import { installedVisemes } from './face-state-install.js';
import { findFacePartByType } from '../../rig-editor/semantic-parts/face-roles.js';
import { EXPRESSION_PRESETS } from '../expressions/expression-presets.js';
import { findExpression } from '../expressions/expression-model.js';

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const near = (a, b, epsilon = 0.02) => Math.abs(number(a) - number(b)) < epsilon;

/**
 * The artwork each kind of corrective can be captured on.
 *
 * An eye's correctives go on its **lids**, because a lid is what draws the
 * eye's line and the eye itself is a group. A mouth's go on the lips, the
 * teeth and the tongue — whichever of the three the mascot draws.
 *
 * Read off the semantic parts rather than guessed from ids, so a mascot whose
 * lids are called something else still offers the right shapes.
 */
export function correctiveTargets(document = {}, kind, side = null) {
  if (kind === 'eye') {
    const lids = findFacePartByType(document, 'eyelids');
    if (!lids) return [];
    const wanted = side === 'left' ? ['leftUpper', 'leftLower'] : side === 'right' ? ['rightUpper', 'rightLower'] : Object.keys(lids.roles || {});
    return wanted
      .map((role) => ({ role, id: lids.roles?.[role] }))
      .filter((item) => item.id && document.elements?.[item.id])
      .map((item) => ({ ...item, name: document.layerMetadata?.[item.id]?.name || item.id, path: document.elements[item.id].restPath || null }));
  }
  const mouth = findFacePartByType(document, 'mouth');
  if (!mouth) return [];
  return ['mouth', 'teeth', 'teethLower', 'tongue', 'tongueTip', 'tongueGroove', 'cavity']
    .map((role) => ({ role, id: mouth.roles?.[role] }))
    .filter((item) => item.id && document.elements?.[item.id])
    .map((item) => ({ ...item, name: document.layerMetadata?.[item.id]?.name || item.id, path: document.elements[item.id].restPath || null }));
}

/**
 * One kind's corrective slots, with what is captured in each.
 *
 * `activation` is how strongly the live face is asking for the slot right now,
 * which is the number that turns a list of nine sentences into a panel an
 * author can read: the ones lit up are the ones this pose is using.
 */
export function correctiveRows(document = {}, kind, { side = null, values = {} } = {}) {
  const targets = correctiveTargets(document, kind, side);
  return correctiveSlotsFor(kind).map((slot) => {
    const captured = targets
      .map((target) => ({ target, key: findFaceCorrective(document, { kind, slot: slot.id, side: slot.sided ? side : null, target: target.id }) }))
      .filter((item) => item.key)
      .map((item) => ({
        id: item.key.id, target: item.target.id, targetName: item.target.name,
        weight: faceCorrectiveWeight(item.key), points: item.key.delta.length / 2
      }));
    // The slot's sentence is a *function* of the side; what a row carries is
    // the sentence itself, resolved. Spreading the descriptor whole would put a
    // closure on the model, and the model has to survive `structuredClone`:
    // the e2e hooks and the panel's own snapshot both take one.
    const { sentence, ...descriptor } = slot;
    void sentence;
    return {
      ...descriptor,
      expression: correctiveExpression(kind, slot.id, slot.sided ? side : null),
      activation: Number(activeCorrectiveSlots(kind, values, { side: slot.sided ? side : null, epsilon: 0 })
        .find((item) => item.id === slot.id)?.activation ?? 0),
      targets, captured,
      // A slot with nothing behind it is not a problem: the state is then the
      // plain composition of its controls, which is the whole point of a
      // corrective being optional.
      captureable: targets.some((target) => target.path)
    };
  });
}

/**
 * The eight eye states, for one eye or for the pair.
 *
 * `values` says what to write when the chip is pressed, and `active` whether
 * the live face is already standing there — the same two questions a pose chip
 * answers, asked per side.
 */
export function eyeStateRows(document = {}, { side = null, values = {} } = {}) {
  return EYE_POSE_PRESETS.map((pose) => {
    const resolved = resolveEyePose(document, pose.id);
    const write = eyePoseValues(document, pose.id, side);
    return {
      id: pose.id, name: pose.name, description: pose.description,
      controls: resolved.controls, values: write, missing: resolved.missing,
      usable: resolved.usable,
      active: Object.keys(write).length > 0 && Object.entries(write).every(([name, value]) => near(values[name], value))
    };
  });
}

/** The nine visemes, with whether the project carries each as an expression. */
export function visemeRows(document = {}, { values = {} } = {}) {
  const installed = new Set(installedVisemes(document));
  return VISEME_PRESETS.map((preset) => {
    const resolved = resolveViseme(document, preset.id);
    return {
      id: preset.id, name: preset.name, description: preset.description,
      expressionId: visemeExpressionId(preset.id), installed: installed.has(preset.id),
      controls: resolved.controls, missing: resolved.missing, usable: resolved.usable,
      // Which correctives this viseme actually reaches, strongest first: nine
      // sentences is a list, three lit ones is an answer.
      correctives: activeCorrectiveSlots('mouth', resolved.controls).map((slot) => ({ id: slot.id, name: slot.name, activation: slot.activation })),
      active: resolved.usable && Object.entries(resolved.controls).every(([name, value]) => near(values[name], value))
    };
  });
}

/**
 * The faces a combined preview can be built on.
 *
 * The project's own expressions first — those are the ones an author made —
 * and the catalogue's names for the ones it shipped, so the row reads *Happy*
 * rather than `happy`. The visemes are filtered out: they are the other half
 * of the combination, not a face to combine with.
 */
export function expressionRows(document = {}) {
  const named = new Map(EXPRESSION_PRESETS.map((preset) => [preset.id, preset.name]));
  return (document.expressions || [])
    .filter((item) => !item.viseme && item.source !== 'viseme')
    .map((item) => ({ id: item.id, name: item.name || named.get(item.id) || item.id, controls: { ...(item.controls || {}) } }));
}

/**
 * Everything the panel needs, in one read.
 *
 * `ready` is whether there is anything here to author at all: the eyes' part
 * has to have lids and the mouth has to have a piece of artwork, because a
 * corrective deforms a path and a state without one is a slider nobody can
 * see move.
 */
export function faceStateModel(document = {}, { side = 'left', values = {}, expressionId = null, viseme = null, blend = 1 } = {}) {
  const lids = findFacePartByType(document, 'eyelids');
  const mouth = findFacePartByType(document, 'mouth');
  const expression = expressionId ? findExpression(document, expressionId) : null;
  return {
    eyes: {
      part: lids?.id || null,
      side,
      ready: correctiveTargets(document, 'eye', side).length > 0,
      states: eyeStateRows(document, { side, values }),
      correctives: correctiveRows(document, 'eye', { side, values }),
      // Whether the two eyes can disagree at all, which is what decides
      // whether a state applies to one side or to the pair.
      sided: Boolean(document.params?.eyeOpenLeft || document.params?.eyeOpenRight)
    },
    mouth: {
      part: mouth?.id || null,
      ready: correctiveTargets(document, 'mouth').length > 0,
      visemes: visemeRows(document, { values }),
      correctives: correctiveRows(document, 'mouth', { values }),
      expressions: expressionRows(document),
      combination: { expressionId: expression?.id || null, expression: expression?.name || null, viseme, blend }
    },
    // Correctives across the whole face, for the "what has been captured"
    // count a collapsed heading shows.
    captured: faceCorrectives(document).length
  };
}

/**
 * The live values a combination asks for, ready to be written to the preview.
 *
 * An expression, an eye state and a viseme at a blend, composed the way the
 * mixer composes them (`composeFaceState`) — which is the whole point of the
 * combined preview: an author checking *happy + AE at 0.65* is checking the
 * arithmetic the runtime will do, not an approximation of it.
 */
export { composeFaceState } from './face-states.js';
export { faceCorrectiveId };
