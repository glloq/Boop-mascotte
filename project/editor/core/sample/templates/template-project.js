import { createCleanProjectState } from '../../state/store.js';
import { assignSemanticRole, captureSemanticMorph, createSemanticPart, enableSemanticControl, setSemanticControlMethod } from '../../../rig-editor/semantic-parts/part-model.js';

const params={lookX:{type:'number',min:-1,max:1,default:0,value:0},lookY:{type:'number',min:-1,max:1,default:0,value:0},eyeOpen:{type:'number',min:0,max:1,default:1,value:1},mouthOpen:{type:'number',min:0,max:1,default:0,value:0},smile:{type:'number',min:-1,max:1,default:0,value:0}};
const base={lookX:0,lookY:0,eyeOpen:1,mouthOpen:0,smile:0};
const clips={
  look:{id:'look-around',name:'Look Around',duration:2,loop:true,tracks:{lookX:[{time:0,value:-1,easing:'linear'},{time:1,value:1,easing:'easeInOut'},{time:2,value:-1,easing:'easeInOut'}]}},
  smile:{id:'smile',name:'Smile',duration:1,loop:false,tracks:{smile:[{time:0,value:0,easing:'linear'},{time:1,value:1,easing:'easeInOut'}]}},
  blink:{id:'blink-clip',name:'Blink',duration:.3,loop:false,tracks:{eyeOpen:[{time:0,value:1,easing:'linear'},{time:.15,value:0,easing:'easeIn'},{time:.3,value:1,easing:'easeOut'}]}},
  happy:{id:'happy',name:'Happy',duration:1,loop:false,tracks:{smile:[{time:0,value:0,easing:'linear'},{time:1,value:1,easing:'easeInOut'}]}},
  surprised:{id:'surprised',name:'Surprised',duration:1,loop:false,tracks:{mouthOpen:[{time:0,value:0,easing:'linear'},{time:1,value:1,easing:'easeOut'}],eyeOpen:[{time:0,value:.7,easing:'linear'},{time:1,value:1,easing:'easeOut'}]}},
  nod:{id:'head-nod',name:'Head Nod',duration:1,loop:false,tracks:{headTilt:[{time:0,value:0,easing:'linear'},{time:.5,value:.4,easing:'easeInOut'},{time:1,value:0,easing:'easeInOut'}]}},
  talk:{id:'simple-talk',name:'Simple Talk',duration:1,loop:true,tracks:{mouthOpen:[{time:0,value:0,easing:'linear'},{time:.25,value:1,easing:'easeOut'},{time:.5,value:0,easing:'easeIn'},{time:.75,value:.7,easing:'easeOut'},{time:1,value:0,easing:'easeIn'}]}}
};
function add(state,type,roles,controls=[]){const part=createSemanticPart(state,type);for(const [role,id] of Object.entries(roles))assignSemanticRole(state,part.id,role,id);for(const control of controls)enableSemanticControl(state,part.id,control);return part;}
export function applyTemplateProject(state, kind) {
  const document={svgMarkup:state.svgMarkup,elements:state.elements,layers:state.layers,layerMetadata:state.layerMetadata,svgWarnings:state.svgWarnings};
  Object.assign(state,createCleanProjectState(),document);for(const element of Object.values(state.elements)){element.bindings={};delete element.morph;}
  state.params=structuredClone(params);state.states={idle:{...base},happy:{...base,smile:1},surprised:{...base,eyeOpen:1,mouthOpen:1}};state.transitions={idle:['happy','surprised'],happy:['idle'],surprised:['idle']};state.transitionSettings={'idle->happy':{duration:350,easing:'easeInOut'}};state.activeState='idle';
  add(state,'head',{head:'head'},['headX','headY','headTilt']);
  if(kind==='builder'){
    add(state,'eyes',{leftEye:'eyeLeft',rightEye:'eyeRight'},['eyeOpen']);add(state,'gaze',{leftPupil:'pupilLeft',rightPupil:'pupilRight'},['lookX','lookY']);add(state,'eyebrows',{leftBrow:'browLeft',rightBrow:'browRight'},['browRaise','browTilt']);add(state,'mouth',{mouth:'mouth'},['mouthOpen','smile','mouthWidth']);state.behaviors=[];state.animationClips=[clips.smile];
  } else add(state,'gaze',{leftPupil:'pupilLeft',rightPupil:'pupilRight'},['lookX','lookY']);
  const mouth=kind==='builder'?state.semanticParts.mouth:add(state,'mouth',{mouth:'mouth'},['mouthOpen','smile','mouthWidth']);
  if(kind==='expressive'){add(state,'eyes',{leftEye:'eyeLeft',rightEye:'eyeRight'},['eyeOpen']);const eyelids=add(state,'eyelids',{leftUpper:'upperLidLeft',rightUpper:'upperLidRight',leftLower:'lowerLidLeft',rightLower:'lowerLidRight'},['eyeOpen']);setSemanticControlMethod(state,eyelids.id,'eyeOpen','morph');captureSemanticMorph(state,eyelids.id,'eyeOpen','closed',{leftUpper:'M61 100 Q85 100 109 100',rightUpper:'M131 100 Q155 100 179 100',leftLower:'M61 103 Q85 103 109 103',rightLower:'M131 103 Q155 103 179 103'});captureSemanticMorph(state,eyelids.id,'eyeOpen','open',{leftUpper:'M61 100 Q85 78 109 100',rightUpper:'M131 100 Q155 78 179 100',leftLower:'M61 103 Q85 119 109 103',rightLower:'M131 103 Q155 119 179 103'});add(state,'eyebrows',{leftBrow:'browLeft',rightBrow:'browRight'},['browRaise','browTilt']);add(state,'nose',{nose:'nose'});add(state,'jaw',{jaw:'jaw'},['jawOpen']);add(state,'hair',{hair:'hair'},['hairSway','hairLift']);state.behaviors=[{id:'blink',type:'blink',name:'Blink',enabled:true,parameter:'eyeOpen',intervalMin:2,intervalMax:6,duration:.12,closedValue:0},{id:'idle-sway',type:'oscillator',name:'Idle',enabled:true,parameter:'lookY',amplitude:.05,frequency:.3,offset:0,waveform:'sine'}];state.animationClips=[clips.look,clips.blink,clips.happy,clips.surprised,clips.nod];}
  else if(kind==='talking'){add(state,'eyes',{leftEye:'eyeLeft',rightEye:'eyeRight'},['eyeOpen']);add(state,'jaw',{jaw:'jaw'},['jawOpen']);state.behaviors=[{id:'blink',type:'blink',name:'Blink',enabled:true,parameter:'eyeOpen',intervalMin:2,intervalMax:6,duration:.12,closedValue:0}];setSemanticControlMethod(state,mouth.id,'mouthOpen','morph');captureSemanticMorph(state,mouth.id,'mouthOpen','neutral',{mouth:'M80 158 Q120 166 160 158 Q120 178 80 158 Z'});captureSemanticMorph(state,mouth.id,'mouthOpen','open',{mouth:'M80 158 Q120 155 160 158 Q120 204 80 158 Z'});state.animationClips=[clips.talk];}
  else if(kind==='basic') {add(state,'eyes',{leftEye:'eyeLeft',rightEye:'eyeRight'},['eyeOpen']);add(state,'eyebrows',{leftBrow:'browLeft',rightBrow:'browRight'},['browRaise','browTilt']);state.behaviors=[];state.animationClips=[clips.look,clips.smile];}
  state.animationClips=structuredClone(state.animationClips);state.animationEditor={activeClipId:state.animationClips[0]?.id||null,playhead:0,panel:'preview',autoKey:false};state.selectedId=null;
  return state;
}
