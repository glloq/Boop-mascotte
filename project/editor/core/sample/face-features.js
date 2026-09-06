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
