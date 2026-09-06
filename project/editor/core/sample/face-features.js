import { assignSemanticRole, captureSemanticMorph, createSemanticPart, enableSemanticControl, setSemanticControlMethod } from '../../rig-editor/semantic-parts/part-model.js';

const eyebrows={
  id:'eyebrows',name:'Eyebrows',description:'Curious and angry expressions.',
  mountPoint:'faceRoot',
  artwork:`<g id="eyebrows" data-name="Eyebrows" fill="none" stroke="#57382b" stroke-width="7" stroke-linecap="round"><path id="browLeft" data-name="Left eyebrow" d="M58 76 Q82 62 106 76"/><path id="browRight" data-name="Right eyebrow" d="M134 76 Q158 62 182 76"/></g>`,
  roles:{leftBrow:'browLeft',rightBrow:'browRight'},controls:['browRaise','browTilt'],
  exampleClips:[
    {id:'curious',name:'Curious',duration:1,loop:false,tracks:{browRaise:[{time:0,value:0},{time:.5,value:.8,easing:'easeOut'},{time:1,value:0,easing:'easeIn'}],browTilt:[{time:0,value:0},{time:.5,value:.45,easing:'easeOut'},{time:1,value:0,easing:'easeIn'}]}},
    {id:'angry',name:'Angry',duration:1,loop:false,tracks:{browRaise:[{time:0,value:0},{time:.5,value:-.5,easing:'easeOut'},{time:1,value:0,easing:'easeIn'}],browTilt:[{time:0,value:0},{time:.5,value:-.7,easing:'easeOut'},{time:1,value:0,easing:'easeIn'}]}}
  ]
};
const eyelids={
  id:'eyelids',name:'Eyelids',description:'More natural blinking and eye expressions.',
  mountPoint:'faceRoot',
  artwork:`<g id="eyelids" data-name="Eyelids" fill="#f6d6ad" stroke="#9a6544" stroke-width="3"><path id="upperLidLeft" data-name="Left upper eyelid" d="M57 103 Q82 79 107 103 Q82 87 57 103 Z"/><path id="upperLidRight" data-name="Right upper eyelid" d="M133 103 Q158 79 183 103 Q158 87 133 103 Z"/><path id="lowerLidLeft" data-name="Left lower eyelid" d="M57 106 Q82 116 107 106" fill="none"/><path id="lowerLidRight" data-name="Right lower eyelid" d="M133 106 Q158 116 183 106" fill="none"/></g>`,
  roles:{leftUpper:'upperLidLeft',leftLower:'lowerLidLeft',rightUpper:'upperLidRight',rightLower:'lowerLidRight'},controls:['eyeOpen'],
  exampleClips:[
    {id:'natural-blink',name:'Natural Blink',duration:.42,loop:false,tracks:{eyeOpen:[{time:0,value:1},{time:.18,value:0,easing:'easeIn'},{time:.42,value:1,easing:'easeOut'}]}},
    {id:'sleepy',name:'Sleepy',duration:1.4,loop:false,tracks:{eyeOpen:[{time:0,value:1},{time:.6,value:.35,easing:'easeInOut'},{time:1,value:.35},{time:1.4,value:1,easing:'easeOut'}]}}
  ]
};
export const FACE_FEATURES=Object.freeze({eyebrows:Object.freeze(eyebrows),eyelids:Object.freeze(eyelids)});

/**
 * Where these drawings were drawn: the template's own eye pair and its head.
 *
 * Both features are about the eyes -- lids on them, brows above them -- so the
 * eyes are what they are fitted to, and the head is the fallback for a face
 * whose eyes are not assigned yet.
 */
export const FEATURE_REFERENCE = Object.freeze({
  eyes: Object.freeze({ x: 56, y: 77, width: 128, height: 42 }),
  head: Object.freeze({ x: 20, y: 20, width: 200, height: 200 })
});

/**
 * Where a feature is drawn: inside the head when the head is a group, beside
 * it when it is a shape.
 *
 * `mountPoint: 'faceRoot'` was the template's own group, and a face drawn from
 * the blank canvas has no such thing -- which is why adding a part to one was
 * refused rather than placed. The head part answers it for any mascot: the
 * template's head *is* `faceRoot`, so the brows still go inside it, and a
 * drawn head is an ellipse, so they go beside it in whatever holds it.
 */
export function featureMountPoint(state) {
  const head = Object.values(state?.semanticParts || {}).find((part) => part?.type === 'head')?.roles?.head;
  if (!head) return null;
  const walk = (items, parent) => {
    for (const item of items || []) {
      if (item.id === head) return item.type === 'g' ? item.id : parent;
      const found = walk(item.children, item.id);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  const mount = walk(state?.layers, null);
  return mount === undefined ? null : mount;
}

/**
 * The feature's artwork, placed on the face it is being added to.
 *
 * The drawings are authored against the template's face, so on a mascot
 * somebody drew they landed wherever that face was not -- which is most of why
 * adding a part only ever worked on the starter face. The reference box is
 * mapped onto the measured one and the scale is uniform (a brow stretched on
 * one axis has a stroke that thickens along its length), so the brows sit above
 * the eyes and the lids on them whatever size the face is.
 *
 * @param {string} id
 * @param {{eyes?: {x,y,width,height}, head?: {x,y,width,height}}} boxes measured artwork boxes
 */
export function fitFeatureArtwork(id, boxes = {}) {
  const feature = FACE_FEATURES[id];
  if (!feature) return '';
  const usable = (box) => Boolean(box && Number.isFinite(box.width) && box.width > 0 && Number.isFinite(box.height) && box.height > 0);
  const which = usable(boxes.eyes) ? 'eyes' : usable(boxes.head) ? 'head' : null;
  if (!which) return feature.artwork;
  const from = FEATURE_REFERENCE[which], to = boxes[which];
  const scale = to.width / from.width;
  // Same centre, same proportion: nothing else about the drawing changes.
  const x = (to.x + to.width / 2) - (from.x + from.width / 2) * scale;
  const y = (to.y + to.height / 2) - (from.y + from.height / 2) * scale;
  const round = (value) => Math.round(value * 1000) / 1000;
  if (Math.abs(scale - 1) < 1e-6 && Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6) return feature.artwork;
  return feature.artwork.replace(/^<g /, `<g transform="translate(${round(x)} ${round(y)}) scale(${round(scale)})" `);
}

/** The part playing a role in the mascot, whatever the project happens to call it. */
const partOfType=(state,type)=>Object.values(state?.semanticParts||{}).find(part=>part?.type===type)||null;

/**
 * Does this mascot already have the feature?
 *
 * The question is about the *mascot*, not about the artwork in this file. It
 * used to compare the part's roles against the ids of the snippet above
 * (`upperLidLeft`...), so the template's own eyelids -- the same feature, drawn
 * differently and called `lidUpperLeft` -- read as missing. The card offered
 * "+ Add", and pressing it threw on the part that was already there:
 * "Semantic part id collision: \"eyelids\" already exists".
 */
export function isFaceFeatureInstalled(state,id){const feature=FACE_FEATURES[id],part=partOfType(state,id);return Boolean(feature&&part&&Object.keys(feature.roles).every(role=>state?.elements?.[part.roles?.[role]]));}

/**
 * What the card offering a feature should say, and whether it can be pressed.
 *
 * Every reason a press would fail is checked here rather than thrown at the
 * author afterwards: a half-assigned part of the same kind, artwork already
 * drawing one of the ids, a motion already using one of the example clip ids.
 * `installFaceFeatureCommand` still refuses the same cases -- it is the guard
 * on the document -- but nothing reaches it that this could have explained.
 */
export function describeFaceFeature(state,id){
  const feature=FACE_FEATURES[id];
  if(!feature)return{installed:false,available:false,reason:'Unknown part.'};
  if(isFaceFeatureInstalled(state,id))return{installed:true,available:false,reason:null};
  const part=partOfType(state,id);
  if(part)return{installed:false,available:false,reason:`This mascot already has ${feature.name.toLowerCase()}. Finish assigning their artwork in Face Setup.`};
  const drawn=[feature.id,...Object.values(feature.roles)].find(elementId=>state?.elements?.[elementId]);
  if(drawn)return{installed:false,available:false,reason:`The artwork already draws "${drawn}".`};
  const clip=feature.exampleClips.find(item=>(state?.animationClips||[]).some(existing=>existing.id===item.id));
  if(clip)return{installed:false,available:false,reason:`A motion called "${clip.id}" already exists.`};
  return{installed:false,available:true,reason:null};
}
export function installFaceFeature(state,id){const feature=FACE_FEATURES[id];if(!feature||isFaceFeatureInstalled(state,id)||partOfType(state,id))return false;const part=createSemanticPart(state,id);for(const [role,element] of Object.entries(feature.roles))assignSemanticRole(state,part.id,role,element);for(const control of feature.controls)enableSemanticControl(state,part.id,control);if(id==='eyelids'){setSemanticControlMethod(state,part.id,'eyeOpen','morph');captureSemanticMorph(state,part.id,'eyeOpen','closed',{leftUpper:'M57 103 Q82 103 107 103 Q82 106 57 103 Z',leftLower:'M57 106 Q82 106 107 106',rightUpper:'M133 103 Q158 103 183 103 Q158 106 133 103 Z',rightLower:'M133 106 Q158 106 183 106'});captureSemanticMorph(state,part.id,'eyeOpen','open',{leftUpper:'M57 103 Q82 79 107 103 Q82 87 57 103 Z',leftLower:'M57 106 Q82 116 107 106',rightUpper:'M133 103 Q158 79 183 103 Q158 87 133 103 Z',rightLower:'M133 106 Q158 116 183 106'});}state.animationClips.push(...structuredClone(feature.exampleClips));return true;}
