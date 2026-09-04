// Presentation-only metadata. Runtime and project schema continue to use parameter ids.
export const CONTROL_CATALOG = Object.freeze({
  headX:{label:'Move left / right',part:'head',group:'Head'}, headY:{label:'Move up / down',part:'head',group:'Head'},
  headTilt:{label:'Tilt',part:'head',group:'Head'}, lookX:{label:'Look left / right',part:'gaze',group:'Gaze'},
  lookY:{label:'Look up / down',part:'gaze',group:'Gaze'}, eyeOpen:{label:'Open / close',part:'eyes',group:'Eyes'},
  smile:{label:'Smile',part:'mouth',group:'Mouth'}, mouthOpen:{label:'Open / close',part:'mouth',group:'Mouth'}, mouthWidth:{label:'Width',part:'mouth',group:'Mouth'},
  browRaise:{label:'Raise',part:'eyebrows',group:'Eyebrows'}, browTilt:{label:'Tilt',part:'eyebrows',group:'Eyebrows'}
});

/**
 * Hand controls are generated, not declared (VNX-34).
 *
 * A hand's parameters are built from its side and a suffix — `handLX`,
 * `handRGrip`, `handLIndex`, `handRFist` — so no static table can list them:
 * a project can add a pose called anything. They were therefore falling through
 * to the fallback and showing as raw ids under "Other", which is exactly the
 * fifteen-raw-parameters complaint this item exists for.
 *
 * The naming rule lives in `core/sample/hand-feature.js` (`named()`) and in
 * `handPoseParameterName()`; this reads it back rather than repeating it, so a
 * suffix nobody anticipated still lands in the right hand's group with a
 * readable name instead of vanishing into Other.
 */
const HAND_TRANSFORM = Object.freeze({
  X: 'Move left / right', Y: 'Move up / down', Rotation: 'Turn', Scale: 'Size', Depth: 'Draw order'
});
const HAND_SHAPE = Object.freeze({ Grip: 'Close the hand', Flip: 'Palm or back' });
const HAND_DIGIT_LABEL = Object.freeze({ Thumb: 'Thumb', Index: 'Index', Middle: 'Middle', Ring: 'Ring' });

/** `handLGrip` → `{ side: 'left', suffix: 'Grip' }`, or null for anything else. */
function handParameter(parameter) {
  const match = /^hand([LR])([A-Z].*)$/.exec(String(parameter));
  return match ? { side: match[1] === 'R' ? 'right' : 'left', suffix: match[2] } : null;
}

function handControlMeta(parameter) {
  const hand = handParameter(parameter);
  if (!hand) return null;
  const group = hand.side === 'right' ? 'Right hand' : 'Left hand';
  const part = `hand-${hand.side}`;
  if (HAND_TRANSFORM[hand.suffix]) return { label: HAND_TRANSFORM[hand.suffix], part, group, section: 'Transform' };
  if (HAND_SHAPE[hand.suffix]) return { label: HAND_SHAPE[hand.suffix], part, group, section: 'Shape' };
  if (HAND_DIGIT_LABEL[hand.suffix]) return { label: HAND_DIGIT_LABEL[hand.suffix], part, group, section: 'Fingers' };
  // Whatever is left is a pose the author named. `handRThumbsUp` reads back as
  // "Thumbs up" rather than as a parameter id.
  const words = hand.suffix.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return { label: `${words.charAt(0).toUpperCase()}${words.slice(1)}`, part, group, section: 'Poses' };
}

export const controlMeta = (parameter) => CONTROL_CATALOG[parameter] || handControlMeta(parameter) || { label: parameter, part: null, group: 'Other' };
export function availableControlGroups(params, excluded = []) {
  const groups = new Map();
  Object.keys(params).filter(id=>!excluded.includes(id)).forEach(id=>{const meta=controlMeta(id);if(!groups.has(meta.group))groups.set(meta.group,[]);groups.get(meta.group).push({id,...meta});});
  return groups;
}
