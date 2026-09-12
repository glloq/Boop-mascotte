const number = (min, max, value = 0) => ({ type: 'number', min, max, default: value, value });
const tri=(low,neutral,high,lowKey='low',neutralKey='neutral',highKey='high')=>({poses:[{key:lowKey,label:low,value:-1},{key:neutralKey,label:neutral,value:0},{key:highKey,label:high,value:1}]});
const binary=(low,high,lowKey='closed',highKey='open')=>({poses:[{key:lowKey,label:low,value:0},{key:highKey,label:high,value:1}]});
// `morph` is the legacy one-per-element A/B shape; `shapeKey` is the V2 one,
// additive and unlimited, which is what lets a mouth open and smile at once.
export const SUPPORTED_SEMANTIC_DRIVER_PROPERTIES=Object.freeze(['translateX','translateY','rotation','scaleX','scaleY','opacity','morph','shapeKey']);

/**
 * The transform properties one control writes, as a list.
 *
 * A movement is one property on one role -- a brow raises by `translateY` --
 * and that was the only shape the registry could express. A pupil that *scales*
 * cannot be said that way: it has to write `scaleX` and `scaleY` together, or
 * the pupil goes oval. So a binding entry may name an array, and everything
 * downstream reads it through here rather than assuming a string.
 */
export const driverPropertyList = (value) => (Array.isArray(value) ? value.filter(Boolean) : value ? [value] : []);

/** What a control would write on the artwork, before any author override. */
export function semanticDriverProperties(definition, control, options = {}) {
  const configured = options.property ?? definition?.drivers?.[control]?.property
    ?? Object.values(definition?.bindings || {}).find((map) => map[control])?.[control];
  return driverPropertyList(configured);
}

/** What a control *is* writing: the driver an author ended up with. */
export const driverProperties = (driver) =>
  (Array.isArray(driver?.properties) && driver.properties.length ? driver.properties.filter(Boolean) : driverPropertyList(driver?.property));

export const SEMANTIC_PART_REGISTRY = Object.freeze({
  head: { displayName: 'Head', roles: ['head'], controls: ['headX', 'headY', 'headTilt'], parameters: { headX: number(-1, 1), headY: number(-1, 1), headTilt: number(-1, 1) }, bindings: { head: { headX: 'translateX', headY: 'translateY', headTilt: 'rotation' } }, drivers:{headX:{property:'translateX',amplitude:8,offset:0},headY:{property:'translateY',amplitude:8,offset:0},headTilt:{property:'rotation',amplitude:8,offset:0}}, calibration:{headX:tri('LEFT','CENTER','RIGHT','left','center','right'),headY:tri('UP','CENTER','DOWN','up','center','down'),headTilt:tri('TILT LEFT','CENTER','TILT RIGHT','tiltLeft','center','tiltRight')} },
  eyes: { displayName: 'Eyes', sides: { leftEye: 'Left', rightEye: 'Right' }, sided: ['eyeOpen'], roles: ['leftEye', 'rightEye'], controls: ['eyeOpen'], parameters: { eyeOpen: number(0, 1, 1) }, bindings: { leftEye:{eyeOpen:'scaleY'},rightEye:{eyeOpen:'scaleY'} }, drivers:{eyeOpen:{property:'scaleY',amplitude:1,offset:0}}, strategies:{eyeOpen:['scaleY','morph']}, calibration:{eyeOpen:binary('CLOSED','OPEN')}, symmetry: true },
  // `sides` and `sided` are what let the two eyes disagree (docs/FACE_CONTROL_RIG.md):
  // `lookX + lookXLeft` per pupil, so convergence, a lazy eye and a cartoon
  // squint stop being impossible and the shared control keeps its meaning.
  // `pupilScale` is the one movement that has to write **both** scale axes: a
  // pupil that dilates on one axis is an oval, not a pupil.
  gaze: { displayName: 'Pupils / Gaze', sides: { leftPupil: 'Left', rightPupil: 'Right' }, sided: ['lookX', 'lookY', 'pupilScale'], roles: ['leftPupil', 'rightPupil'], controls: ['lookX', 'lookY', 'pupilScale'], parameters: { lookX: number(-1, 1), lookY: number(-1, 1), pupilScale: number(0.4, 1.6, 1) }, bindings: { leftPupil: { lookX: 'translateX', lookY: 'translateY', pupilScale: ['scaleX', 'scaleY'] }, rightPupil: { lookX: 'translateX', lookY: 'translateY', pupilScale: ['scaleX', 'scaleY'] } }, drivers:{pupilScale:{property:['scaleX','scaleY'],amplitude:1,offset:0}}, calibration:{lookX:tri('LEFT','CENTER','RIGHT','left','center','right'),lookY:tri('UP','CENTER','DOWN','up','center','down'),pupilScale:{poses:[{key:'small',label:'SMALL',value:.4},{key:'normal',label:'NORMAL',value:1},{key:'large',label:'LARGE',value:1.6}]}}, symmetry: true },
  // A lid is the one movement in the registry that rests at its *maximum*:
  // `eyeOpen` sits at 1, and closing counts down to 0. So its amplitude is
  // **negative** -- the lid travels as the number falls -- and its offset is
  // what puts the drawing back where it was drawn at 1. Left to the generic
  // `translate` default (`+8`, offset `0`) a lid hung over the open eye and
  // retracted to nothing as it shut, which is a blink played backwards.
  eyelids: { displayName: 'Eyelids', sides: { leftUpper: 'Left', leftLower: 'Left', rightUpper: 'Right', rightLower: 'Right' }, sided: ['eyeOpen'], roles: ['leftUpper', 'leftLower', 'rightUpper', 'rightLower'], controls: ['eyeOpen'], parameters: { eyeOpen: number(0, 1, 1) }, bindings:{leftUpper:{eyeOpen:'translateY'},leftLower:{eyeOpen:'translateY'},rightUpper:{eyeOpen:'translateY'},rightLower:{eyeOpen:'translateY'}}, drivers:{eyeOpen:{property:'translateY',amplitude:-8,offset:8}}, strategies:{eyeOpen:['translateY','rotation','morph']}, calibration:{eyeOpen:binary('CLOSED','OPEN')}, morph: true, symmetry: true },
  // **Up is a negative translate**, because screen `y` grows downwards, and a
  // movement whose calibration says RAISED at +1 has to actually raise the
  // artwork. Without a driver of its own a translate falls back to +8, so
  // `browRaise 1` *lowered* the brows and `hairLift 1` pulled the hair down
  // over the forehead -- every control here reading backwards from the poses
  // the editor offers for it. `noseScrunch` had always carried its own -5 for
  // exactly this reason; these are the rest of the family.
  eyebrows: { displayName: 'Eyebrows', sides: { leftBrow: 'Left', rightBrow: 'Right' }, sided: ['browRaise', 'browTilt'], roles: ['leftBrow', 'rightBrow'], controls: ['browRaise', 'browTilt'], parameters: { browRaise: number(-1, 1), browTilt: number(-1, 1) }, bindings:{leftBrow:{browRaise:'translateY',browTilt:'rotation'},rightBrow:{browRaise:'translateY',browTilt:'rotation'}}, drivers:{browRaise:{property:'translateY',amplitude:-8,offset:0}}, calibration:{browRaise:tri('LOW','NEUTRAL','RAISED'),browTilt:tri('TILT LEFT','NEUTRAL','TILT RIGHT','tiltLeft','neutral','tiltRight')}, symmetry: true },
  nose: { displayName: 'Nose', roles: ['nose'], controls: ['noseScrunch'], parameters: { noseScrunch: number(0, 1) }, bindings:{nose:{noseScrunch:'translateY'}}, drivers:{noseScrunch:{property:'translateY',amplitude:-5,offset:0}}, strategies:{noseScrunch:['translateY','scaleY','rotation']}, calibration:{noseScrunch:binary('RELAXED','SCRUNCHED')} },
  // `cavity`, `teeth` and `tongue` are what an open mouth has inside it, when
  // the artwork draws them as their own shapes. They are optional, and what
  // they buy is that the 2.5D turn moves them with the lip line instead of
  // leaving them behind, and that Teeth and Tongue are movements like any other.
  //
  // Both ways of showing them are strategies, because both are installed: the
  // template deforms bands out of its own lip curves (`shapeKey`), and a
  // library mouth that *draws* its teeth fades them in instead
  // (`DRAWN_DRIVERS` in `face-part-install.js`). Listing only the first left
  // the installer writing a method the Movement Inspector then refused to set
  // -- "Method \"opacity\" is not supported by teeth" on a mouth wearing one.
  mouth: { displayName: 'Mouth', roles: ['mouth', 'cavity', 'teeth', 'tongue'], requiredRoles: ['mouth'], controls: ['mouthOpen', 'smile', 'mouthWidth', 'teeth', 'tongue'], parameters: { mouthOpen: number(0, 1), smile: number(-1, 1), mouthWidth: number(-1, 1), teeth: number(0, 1), tongue: number(0, 1) }, bindings:{mouth:{mouthOpen:'scaleY',smile:'translateY',mouthWidth:'scaleX'},teeth:{teeth:'shapeKey'},tongue:{tongue:'shapeKey'}}, drivers:{mouthOpen:{property:'scaleY',amplitude:1,offset:1},smile:{property:'translateY',amplitude:8,offset:0},mouthWidth:{property:'scaleX',amplitude:.25,offset:1},teeth:{property:'shapeKey'},tongue:{property:'shapeKey'}}, strategies:{mouthOpen:['shapeKey','scaleY','morph'],smile:['shapeKey','translateY','morph'],mouthWidth:['scaleX'],teeth:['shapeKey','opacity'],tongue:['shapeKey','opacity']}, calibration:{mouthOpen:binary('CLOSED / NEUTRAL','OPEN')}, morph: true },
  // The tongue is its own part, not a fifth control on the mouth: the mouth's
  // `tongue` control says *whether it shows*, and these say where it is
  // (docs/FACE_CONTROL_RIG.md, CR-32 … CR-34). Two parts may share artwork so
  // long as they write different properties, and they do.
  tongue: { displayName: 'Tongue', roles: ['tongue'], controls: ['tongueX', 'tongueY', 'tongueOut', 'tongueCurl'], parameters: { tongueX: number(-1, 1), tongueY: number(-1, 1), tongueOut: number(0, 1), tongueCurl: number(-1, 1) }, bindings: { tongue: { tongueX: 'translateX', tongueY: 'translateY', tongueOut: 'scaleY', tongueCurl: 'rotation' } }, drivers: { tongueX: { property: 'translateX', amplitude: 7, offset: 0 }, tongueY: { property: 'translateY', amplitude: 6, offset: 0 }, tongueOut: { property: 'scaleY', amplitude: .6, offset: 1 }, tongueCurl: { property: 'rotation', amplitude: 18, offset: 0 } }, calibration: { tongueX: tri('LEFT', 'CENTER', 'RIGHT', 'left', 'center', 'right'), tongueY: tri('UP', 'CENTER', 'DOWN', 'up', 'center', 'down'), tongueOut: binary('IN', 'OUT'), tongueCurl: tri('CURL DOWN', 'FLAT', 'CURL UP', 'down', 'flat', 'up') } },
  jaw: { displayName: 'Jaw', roles: ['jaw'], controls: ['jawOpen'], parameters: { jawOpen: number(0, 1) }, bindings:{jaw:{jawOpen:'translateY'}}, drivers:{jawOpen:{property:'translateY',amplitude:16,offset:0}}, strategies:{jawOpen:['translateY','rotation']}, calibration:{jawOpen:binary('CLOSED','OPEN')} },
  // A head of hair is more than a fringe: `hairTop` is the volume above the
  // skull and `hairBack` what shows behind it. Both optional, both moved by the
  // same two controls -- hair that sways in three pieces, not one.
  hair: { displayName: 'Hair', roles: ['hair', 'hairTop', 'hairBack'], requiredRoles: ['hair'], controls: ['hairSway', 'hairLift'], parameters: { hairSway: number(-1, 1), hairLift: number(-1, 1) }, bindings:{hair:{hairSway:'rotation',hairLift:'translateY'},hairTop:{hairSway:'rotation',hairLift:'translateY'},hairBack:{hairSway:'rotation',hairLift:'translateY'}}, drivers:{hairSway:{property:'rotation',amplitude:-8,offset:0},hairLift:{property:'translateY',amplitude:-8,offset:0}}, calibration:{hairSway:tri('LEFT','CENTER','RIGHT','left','center','right'),hairLift:tri('LOW','CENTER','HIGH','low','center','high')} },
  ears: { displayName: 'Ears', roles: ['leftEar', 'rightEar'], controls: ['earWiggle'], parameters: { earWiggle: number(-1, 1) }, bindings:{leftEar:{earWiggle:'rotation'},rightEar:{earWiggle:'rotation'}}, drivers:{earWiggle:{property:'rotation',amplitude:12,offset:0}}, strategies:{earWiggle:['rotation','translateY']}, calibration:{earWiggle:tri('BACK','NEUTRAL','FORWARD','back','neutral','forward')}, symmetry: true },
  leftHand: { displayName: 'Left Hand', roles: ['hand'], controls: [], parameters: {} },
  rightHand: { displayName: 'Right Hand', roles: ['hand'], controls: [], parameters: {} },
  accessory: { displayName: 'Accessory / Generic', roles: ['element'], controls: [], parameters: {} },
  // Facial hair has one movement and it is **not its own**: hair growing on a
  // face is carried by the face under it. So the sentence that drives it is
  // the face's, not the part's -- `mouthOpen + jawOpen`, the very sentence the
  // template's chin is stretched by (`templates/template-project.js`), so the
  // mouth takes the jaw with it and an author can still drop the jaw alone.
  // The movement is called `jawOpen` because that is what moves the hair, and
  // the parameter it enables is the jaw's own: a face that has a jaw gains
  // nothing, and one that has not gets the control the beard needs.
  //
  // How far that sentence reaches each drawing, and which way, is the
  // drawing's answer rather than this table's (`builtin/facial-hair.js`): a
  // beard hangs from the jaw and travels with the chin, a goatee sits between
  // a lip that drops and a chin that lengthens and travels furthest of all, a
  // moustache is on the *upper* lip -- which does not move when this mouth
  // opens -- and lifts a little rather than being carried down into the
  // opening under it, and sideburns are on the temples, above the line the jaw
  // stretches from, and claim the movement not at all.
  facialHair: { displayName: 'Facial hair', roles: ['facialHair'], controls: ['jawOpen'], parameters: { jawOpen: number(0, 1), mouthOpen: number(0, 1) }, bindings:{facialHair:{jawOpen:'translateY'}}, drivers:{jawOpen:{property:'translateY',amplitude:12,offset:0,expression:'mouthOpen + jawOpen'}}, strategies:{jawOpen:['translateY','rotation']}, calibration:{jawOpen:binary('CLOSED','OPEN')} }
});

/**
 * The roles a part needs before it is set up. Optional ones (a mouth cavity)
 * are assignable and take part in the turn, but a part without them is ready.
 */
export const requiredSemanticRoles = (definition) => definition?.requiredRoles || definition?.roles || [];

/**
 * The parameter that moves one side of a symmetric movement on its own.
 *
 * `eyeOpen` drives both eyes because one parameter drives every role that
 * carries it, which is right for a blink and useless for a wink. A **side
 * offset** is added inside the binding's own expression --
 * `eyeOpen + eyeOpenLeft` -- so the shared control keeps meaning exactly what
 * it meant, and the offset defaults to 0. A rig without the parameter reads it
 * as 0 (the safe expression evaluator returns 0 for an unknown name), so this
 * fails *open* rather than shut.
 */
export const sideParameterName = (control, side) => `${control}${side}`;

/**
 * What a movement is driven by, before any side offset is added to it.
 *
 * Almost always the movement's own parameter, spelled the same way. Where a
 * part does not move on its own -- facial hair, which is carried by the face
 * it grows on -- the registry writes the sentence instead, and every binding
 * the movement generates reads that.
 */
export const semanticControlDriver = (definition, control) => definition?.drivers?.[control]?.expression || control;

/**
 * The parameters a movement needs the rig to have before it can be bound.
 *
 * Usually one, named after the movement. A movement driven by a sentence about
 * *other* movements needs every word of that sentence to be a parameter too:
 * the validator refuses a binding that reads a name the rig has not got, and a
 * beard installed on a face with no mouth would be exactly that. Only words
 * this table describes are named here -- a side offset is already a parameter
 * of the rig by the time it reaches an expression.
 */
export function semanticControlParameters(definition, control) {
  const expression = definition?.drivers?.[control]?.expression || '';
  const named = Object.keys(definition?.parameters || {}).filter((name) => new RegExp(`\\b${name}\\b`).test(expression));
  return [...new Set([control, ...named])];
}

/** Whether a part can move one side of this movement on its own. */
export const supportsSideControl = (definition, control) => Boolean(definition?.sides) && Boolean(definition?.sided?.includes(control));

/** The two side parameters a movement needs, as `[left, right]`. */
export function sideParametersFor(definition, control) {
  if (!supportsSideControl(definition, control)) return [];
  return [...new Set(Object.values(definition.sides))].map((side) => sideParameterName(control, side));
}

export function getSemanticPartDefinition(type) {
  const definition = SEMANTIC_PART_REGISTRY[type];
  if (!definition) throw new Error(`Unknown semantic part type: ${type}`);
  return definition;
}
