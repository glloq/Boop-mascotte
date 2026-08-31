const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });

export const SEMANTIC_PART_REGISTRY = Object.freeze({
  head: { displayName: 'Head', roles: ['head'], controls: ['headX', 'headY', 'headTilt'], parameters: { headX: number(-1, 1), headY: number(-1, 1), headTilt: number(-1, 1) }, bindings: { head: { headX: 'translateX', headY: 'translateY', headTilt: 'rotation' } }, drivers:{headX:{property:'translateX',amplitude:8,offset:0},headY:{property:'translateY',amplitude:8,offset:0},headTilt:{property:'rotation',amplitude:8,offset:0}} },
  eyes: { displayName: 'Eyes', roles: ['leftEye', 'rightEye'], controls: ['eyeOpen'], parameters: { eyeOpen: number(0, 1, 1) }, bindings: { leftEye:{eyeOpen:'scaleY'},rightEye:{eyeOpen:'scaleY'} }, drivers:{eyeOpen:{property:'scaleY',amplitude:1,offset:0}}, strategies:{eyeOpen:['scaleY','morph','eyelid']}, symmetry: true },
  gaze: { displayName: 'Pupils / Gaze', roles: ['leftPupil', 'rightPupil'], controls: ['lookX', 'lookY'], parameters: { lookX: number(-1, 1), lookY: number(-1, 1) }, bindings: { leftPupil: { lookX: 'translateX', lookY: 'translateY' }, rightPupil: { lookX: 'translateX', lookY: 'translateY' } }, symmetry: true },
  eyelids: { displayName: 'Eyelids', roles: ['leftUpper', 'leftLower', 'rightUpper', 'rightLower'], controls: ['eyeOpen'], parameters: { eyeOpen: number(0, 1, 1) }, bindings:{leftUpper:{eyeOpen:'translateY'},leftLower:{eyeOpen:'translateY'},rightUpper:{eyeOpen:'translateY'},rightLower:{eyeOpen:'translateY'}}, strategies:{eyeOpen:['translateY','rotation','morph']}, morph: true, symmetry: true },
  eyebrows: { displayName: 'Eyebrows', roles: ['leftBrow', 'rightBrow'], controls: ['browRaise', 'browTilt'], parameters: { browRaise: number(-1, 1), browTilt: number(-1, 1) }, bindings:{leftBrow:{browRaise:'translateY',browTilt:'rotation'},rightBrow:{browRaise:'translateY',browTilt:'rotation'}}, symmetry: true },
  nose: { displayName: 'Nose', roles: ['nose'], controls: [], parameters: {} },
  mouth: { displayName: 'Mouth', roles: ['mouth'], controls: ['mouthOpen', 'smile', 'mouthWidth'], parameters: { mouthOpen: number(0, 1), smile: number(-1, 1), mouthWidth: number(-1, 1) }, bindings:{mouth:{mouthOpen:'scaleY',smile:'translateY',mouthWidth:'scaleX'}}, drivers:{mouthOpen:{property:'scaleY',amplitude:1,offset:1},smile:{property:'translateY',amplitude:8,offset:0},mouthWidth:{property:'scaleX',amplitude:.25,offset:1}}, strategies:{mouthOpen:['scaleY','morph'],smile:['translateY','morph'],mouthWidth:['scaleX','morph']}, morph: true },
  jaw: { displayName: 'Jaw', roles: ['jaw'], controls: ['jawOpen'], parameters: { jawOpen: number(0, 1) }, bindings:{jaw:{jawOpen:'rotation'}}, strategies:{jawOpen:['rotation','translateY']} },
  hair: { displayName: 'Hair', roles: ['hair'], controls: ['hairSway', 'hairLift'], parameters: { hairSway: number(-1, 1), hairLift: number(-1, 1) }, bindings:{hair:{hairSway:'rotation',hairLift:'translateY'}} },
  ears: { displayName: 'Ears', roles: ['leftEar', 'rightEar'], controls: [], parameters: {}, symmetry: true },
  accessory: { displayName: 'Accessory / Generic', roles: ['element'], controls: [], parameters: {} }
});

export function getSemanticPartDefinition(type) {
  const definition = SEMANTIC_PART_REGISTRY[type];
  if (!definition) throw new Error(`Unknown semantic part type: ${type}`);
  return definition;
}
