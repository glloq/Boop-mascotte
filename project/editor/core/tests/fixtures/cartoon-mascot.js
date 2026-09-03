/**
 * The realistic cartoon mascot the roadmap's combination tests describe
 * (docs/V2_ROADMAP.md §69): a face with a 2.5D head-pose grid, additive shape
 * keys on the mouth, two floating hands with poses and inertia, depth
 * parallax, a light hierarchy, expressions, a motion and an idle behaviour.
 *
 * It is also the stress fixture: everything V2 added, in one rig.
 */
import { createHeadPoseAxes, captureHeadPose, headPoseSamplesFromTransforms, mirrorHeadPoseHorizontal } from '../../head-pose/head-pose-model.js';
import { shapeDeltaFromPaths } from '../../shape-keys/shape-key-model.js';
import { assignHand, addHandPose, setHandInertia, handParameters } from '../../hands/hand-model.js';

export const MOUTH_REST = 'M0 0 L20 0 L20 10 L0 10 Z';
export const MOUTH_SMILE = 'M0 -3 L20 -3 L20 10 L0 10 Z';
export const MOUTH_OPEN = 'M0 0 L20 0 L20 18 L0 18 Z';
export const HAND_REST = 'M0 0 L12 0 L12 12 L0 12 Z';
export const HAND_WAVE = 'M0 -4 L12 0 L12 12 L0 12 Z';

const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });
const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });

export function createCartoonMascot() {
  const axes = createHeadPoseAxes();

  const elements = {
    body: { baseTransform: transform(), deformer: 'body', bindings: { translateY: { expression: 'bodyBounce', amplitude: 6 } } },
    head: { baseTransform: transform({ y: -40 }), deformer: 'head' },
    face: { baseTransform: transform({ y: -40 }), deformer: 'head', depth: 0 },
    nose: { baseTransform: transform({ x: 0, y: -40 }), deformer: 'head', depth: 0.6 },
    eyeLeft: { baseTransform: transform({ x: -8, y: -48 }), deformer: 'head', depth: 0.3, bindings: { scaleY: { expression: 'eyeOpen' } } },
    eyeRight: { baseTransform: transform({ x: 8, y: -48 }), deformer: 'head', depth: 0.3, bindings: { scaleY: { expression: 'eyeOpen' } } },
    earLeft: { baseTransform: transform({ x: -20, y: -45 }), deformer: 'head', depth: -0.2, baseOpacity: 1 },
    earRight: { baseTransform: transform({ x: 20, y: -45 }), deformer: 'head', depth: -0.2, baseOpacity: 1 },
    hairBack: { baseTransform: transform({ y: -50 }), deformer: 'head', depth: -0.8 },
    mouth: { baseTransform: transform({ y: -32 }), deformer: 'head', restPath: MOUTH_REST },
    handLeft: { baseTransform: transform({ x: -40, y: 10 }), restPath: HAND_REST },
    handRight: { baseTransform: transform({ x: 40, y: 10 }), restPath: HAND_REST }
  };

  const deformers = [
    { id: 'body', name: 'Body' },
    { id: 'head', name: 'Head', parent: 'body', pivot: { x: 0, y: -40 }, bindings: { rotation: { expression: 'headTilt', amplitude: 6 } } }
  ];

  const shapeKeys = [
    { id: 'mouth-smile', target: 'mouth', name: 'Smile', driver: { mode: 'range', parameter: 'smile', min: 0, max: 1 }, delta: shapeDeltaFromPaths(MOUTH_REST, MOUTH_SMILE) },
    { id: 'mouth-open', target: 'mouth', name: 'Open', driver: { mode: 'range', parameter: 'mouthOpen', min: 0, max: 1 }, delta: shapeDeltaFromPaths(MOUTH_REST, MOUTH_OPEN) },
    { id: 'hand-right-wave', target: 'handRight', name: 'Wave', delta: shapeDeltaFromPaths(HAND_REST, HAND_WAVE) }
  ];

  // A right head turn, captured across every part, then mirrored to the left.
  let keyforms = captureHeadPose([], { axes, cell: { i: 1, j: 1 }, samples: headPoseSamplesFromTransforms(elements, { face: {}, nose: {}, eyeLeft: {}, eyeRight: {}, earLeft: {}, earRight: {}, hairBack: {}, mouth: {} }) });
  keyforms = captureHeadPose(keyforms, {
    axes, cell: { i: 2, j: 1 },
    samples: headPoseSamplesFromTransforms(elements, {
      face: { x: 4 }, nose: { x: 7 }, hairBack: { x: 2 },
      eyeLeft: { x: 3, scaleX: 0.9 }, eyeRight: { x: 5, scaleX: 1.1 },
      earLeft: { opacity: 0.25, scaleX: 0.8 }, earRight: { opacity: 1, scaleX: 1.15 },
      mouth: { x: 3, shapeKeys: { 'mouth-smile': 0.15 } }
    })
  });
  keyforms = captureHeadPose(keyforms, {
    axes, cell: { i: 1, j: 2 },
    samples: headPoseSamplesFromTransforms(elements, { face: { y: -43 }, nose: { y: -44 }, mouth: { y: -34 } })
  });
  keyforms = mirrorHeadPoseHorizontal(keyforms, axes, { earLeft: 'earRight', eyeLeft: 'eyeRight' });

  let hands = assignHand(null, 'left', { element: 'handLeft', parent: 'body', anchor: { x: -30, y: 5 } }).hands;
  hands = assignHand(hands, 'right', { element: 'handRight', parent: 'body', anchor: { x: 30, y: 5 } }).hands;
  hands = addHandPose(hands, 'right', { id: 'wave', name: 'Wave', shapeKey: 'hand-right-wave' });
  hands = setHandInertia(hands, 'right', { enabled: true, stiffness: 0.3, damping: 0.7 });

  const params = {
    headX: number(-1, 1), headY: number(-1, 1), headTilt: number(-1, 1),
    eyeOpen: number(0, 1, 1), smile: number(-1, 1), mouthOpen: number(0, 1),
    lookX: number(-1, 1), lookY: number(-1, 1), bodyBounce: number(-1, 1),
    ...handParameters('left'), ...handParameters('right'),
    handRWave: number(0, 1)
  };
  const idle = Object.fromEntries(Object.entries(params).map(([name, param]) => [name, param.default]));

  return {
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${Object.keys(elements).map((id) => `<path id="${id}" d="M0 0L1 1"/>`).join('')}</svg>`,
    params,
    states: { idle: { ...idle }, happy: { ...idle, smile: 0.8, eyeOpen: 0.9 } },
    activeState: 'idle',
    transitions: { idle: ['happy'], happy: ['idle'] },
    transitionSettings: { 'idle->happy': { duration: 250, easing: 'easeInOut' }, 'happy->idle': { duration: 250, easing: 'easeInOut' } },
    expressionBlend: { duration: 200, easing: 'easeInOut' },
    globalConstraints: { translate: 1, rotate: 1, scale: 1 },
    stateConstraints: {},
    runtimeConfig: { blink: false, idleMotion: 0 },
    elements, deformers, keyforms, shapeKeys, hands,
    parallax: { enabled: true, amount: 6 },
    expressions: [
      { id: 'happy', name: 'Happy', controls: { smile: 0.8, eyeOpen: 0.9 } },
      { id: 'angry', name: 'Angry', controls: { smile: -0.7, eyeOpen: 0.6 } },
      { id: 'surprised', name: 'Surprised', controls: { mouthOpen: 0.8, eyeOpen: 1 } }
    ],
    animationClips: [{ id: 'body-bounce', name: 'BodyBounce', duration: 1, loop: true, tracks: { bodyBounce: [{ time: 0, value: 0 }, { time: 0.5, value: 1 }, { time: 1, value: 0 }] } }],
    behaviors: [
      { id: 'blink', type: 'blink', name: 'Blink', enabled: true, parameter: 'eyeOpen', intervalMin: 2, intervalMax: 4, duration: 0.12, closedValue: 0 },
      { id: 'wander-x', type: 'drift', name: 'Eye wander', enabled: true, parameter: 'lookX', amplitude: 0.25, travelMin: 0.5, travelMax: 1, intervalMin: 1, intervalMax: 2 }
    ],
    reactions: [{ id: 'hello', name: 'Hello', enabled: true, trigger: { type: 'click' }, expression: { id: 'happy', weight: 1 }, motion: { clipId: 'body-bounce' } }],
    semanticParts: {}, layers: [], layerMetadata: {}, animationEditor: { activeClipId: null, playhead: 0, panel: 'preview' }
  };
}

/** The combination the roadmap calls out: nothing here may cancel anything else. */
export const CRITICAL_COMBINATION = Object.freeze({
  headX: 0.6, headY: -0.25,
  eyeOpen: 0.8, smile: 0.75, mouthOpen: 0.3,
  handRX: 0.7, handRY: 0.25, handRRotation: 0.5, handRWave: 1,
  handLX: 0, handLY: 0,
  bodyBounce: 0.5
});
