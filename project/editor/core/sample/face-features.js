import { assignSemanticRole, createSemanticPart, enableSemanticControl } from '../../rig-editor/semantic-parts/part-model.js';

const eyebrowArtwork = `<g id="eyebrows" data-name="Eyebrows" fill="none" stroke="#57382b" stroke-width="7" stroke-linecap="round">
  <path id="browLeft" data-name="Left eyebrow" d="M58 76 Q82 62 106 76" />
  <path id="browRight" data-name="Right eyebrow" d="M134 76 Q158 62 182 76" />
</g>`;

const eyebrowClips = [
  {id:'curious',name:'Curious',duration:1,loop:false,tracks:{browRaise:[{time:0,value:0,easing:'linear'},{time:.5,value:.8,easing:'easeOut'},{time:1,value:0,easing:'easeIn'}],browTilt:[{time:0,value:0,easing:'linear'},{time:.5,value:.45,easing:'easeOut'},{time:1,value:0,easing:'easeIn'}]}},
  {id:'angry',name:'Angry',duration:1,loop:false,tracks:{browRaise:[{time:0,value:0,easing:'linear'},{time:.5,value:-.5,easing:'easeOut'},{time:1,value:0,easing:'easeIn'}],browTilt:[{time:0,value:0,easing:'linear'},{time:.5,value:-.7,easing:'easeOut'},{time:1,value:0,easing:'easeIn'}]}}
];

export const FACE_FEATURES = Object.freeze({
  eyebrows: Object.freeze({id:'eyebrows',name:'Eyebrows',description:'Add curious and angry expressions.',artwork:eyebrowArtwork,exampleClips:eyebrowClips})
});

export function installFaceFeature(state, featureId) {
  if (featureId !== 'eyebrows' || state.semanticParts?.[featureId]) return false;
  const part=createSemanticPart(state,'eyebrows');
  assignSemanticRole(state,part.id,'leftBrow','browLeft');assignSemanticRole(state,part.id,'rightBrow','browRight');
  enableSemanticControl(state,part.id,'browRaise');enableSemanticControl(state,part.id,'browTilt');
  state.animationClips.push(...structuredClone(eyebrowClips));
  state.faceFeatures=[...(state.faceFeatures||['core']),featureId];
  return true;
}
