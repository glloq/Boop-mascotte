const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });
const tri=(low,neutral,high,lowKey='low',neutralKey='neutral',highKey='high')=>({poses:[{key:lowKey,label:low,value:-1},{key:neutralKey,label:neutral,value:0},{key:highKey,label:high,value:1}]});
const binary=(low,high,lowKey='closed',highKey='open')=>({poses:[{key:lowKey,label:low,value:0},{key:highKey,label:high,value:1}]});
export const SUPPORTED_SEMANTIC_DRIVER_PROPERTIES=Object.freeze(['translateX','translateY','rotation','scaleX','scaleY','opacity','morph']);

export const SEMANTIC_PART_REGISTRY = Object.freeze({
  head: { displayName: 'Head', roles: ['head'], controls: ['headX', 'headY', 'headTilt'], parameters: { headX: number(-1, 1), headY: number(-1, 1), headTilt: number(-1, 1) }, bindings: { head: { headX: 'translateX', headY: 'translateY', headTilt: 'rotation' } }, drivers:{headX:{property:'translateX',amplitude:8,offset:0},headY:{property:'translateY',amplitude:8,offset:0},headTilt:{property:'rotation',amplitude:8,offset:0}}, calibration:{headX:tri('LEFT','CENTER','RIGHT','left','center','right'),headY:tri('UP','CENTER','DOWN','up','center','down'),headTilt:tri('TILT LEFT','CENTER','TILT RIGHT','tiltLeft','center','tiltRight')} },
  eyes: { displayName: 'Eyes', roles: ['leftEye', 'rightEye'], controls: ['eyeOpen'], parameters: { eyeOpen: number(0, 1, 1) }, bindings: { leftEye:{eyeOpen:'scaleY'},rightEye:{eyeOpen:'scaleY'} }, drivers:{eyeOpen:{property:'scaleY',amplitude:1,offset:0}}, strategies:{eyeOpen:['scaleY','morph']}, calibration:{eyeOpen:binary('CLOSED','OPEN')}, symmetry: true },
  gaze: { displayName: 'Pupils / Gaze', roles: ['leftPupil', 'rightPupil'], controls: ['lookX', 'lookY'], parameters: { lookX: number(-1, 1), lookY: number(-1, 1) }, bindings: { leftPupil: { lookX: 'translateX', lookY: 'translateY' }, rightPupil: { lookX: 'translateX', lookY: 'translateY' } }, calibration:{lookX:tri('LEFT','CENTER','RIGHT','left','center','right'),lookY:tri('UP','CENTER','DOWN','up','center','down')}, symmetry: true },
  eyelids: { displayName: 'Eyelids', roles: ['leftUpper', 'leftLower', 'rightUpper', 'rightLower'], controls: ['eyeOpen'], parameters: { eyeOpen: number(0, 1, 1) }, bindings:{leftUpper:{eyeOpen:'translateY'},leftLower:{eyeOpen:'translateY'},rightUpper:{eyeOpen:'translateY'},rightLower:{eyeOpen:'translateY'}}, strategies:{eyeOpen:['translateY','rotation','morph']}, calibration:{eyeOpen:binary('CLOSED','OPEN')}, morph: true, symmetry: true },
  eyebrows: { displayName: 'Eyebrows', roles: ['leftBrow', 'rightBrow'], controls: ['browRaise', 'browTilt'], parameters: { browRaise: number(-1, 1), browTilt: number(-1, 1) }, bindings:{leftBrow:{browRaise:'translateY',browTilt:'rotation'},rightBrow:{browRaise:'translateY',browTilt:'rotation'}}, calibration:{browRaise:tri('LOW','NEUTRAL','RAISED'),browTilt:tri('TILT LEFT','NEUTRAL','TILT RIGHT','tiltLeft','neutral','tiltRight')}, symmetry: true },
  nose: { displayName: 'Nose', roles: ['nose'], controls: [], parameters: {} },
  mouth: { displayName: 'Mouth', roles: ['mouth'], controls: ['mouthOpen', 'smile', 'mouthWidth'], parameters: { mouthOpen: number(0, 1), smile: number(-1, 1), mouthWidth: number(-1, 1) }, bindings:{mouth:{mouthOpen:'scaleY',smile:'translateY',mouthWidth:'scaleX'}}, drivers:{mouthOpen:{property:'scaleY',amplitude:1,offset:1},smile:{property:'translateY',amplitude:8,offset:0},mouthWidth:{property:'scaleX',amplitude:.25,offset:1}}, strategies:{mouthOpen:['scaleY','morph'],smile:['translateY','morph'],mouthWidth:['scaleX']}, calibration:{mouthOpen:binary('CLOSED / NEUTRAL','OPEN')}, morph: true },
  jaw: { displayName: 'Jaw', roles: ['jaw'], controls: ['jawOpen'], parameters: { jawOpen: number(0, 1) }, bindings:{jaw:{jawOpen:'rotation'}}, strategies:{jawOpen:['rotation','translateY']}, calibration:{jawOpen:binary('CLOSED','OPEN')} },
  hair: { displayName: 'Hair', roles: ['hair'], controls: ['hairSway', 'hairLift'], parameters: { hairSway: number(-1, 1), hairLift: number(-1, 1) }, bindings:{hair:{hairSway:'rotation',hairLift:'translateY'}}, calibration:{hairSway:tri('LEFT','CENTER','RIGHT','left','center','right'),hairLift:tri('LOW','CENTER','HIGH','low','center','high')} },
  ears: { displayName: 'Ears', roles: ['leftEar', 'rightEar'], controls: [], parameters: {}, symmetry: true },
  accessory: { displayName: 'Accessory / Generic', roles: ['element'], controls: [], parameters: {} }
});

export function getSemanticPartDefinition(type) {
  const definition = SEMANTIC_PART_REGISTRY[type];
  if (!definition) throw new Error(`Unknown semantic part type: ${type}`);
  return definition;
}
