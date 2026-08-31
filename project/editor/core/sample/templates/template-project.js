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
  add(state,'head',{head:'head'},['headX','headY','headTilt']);add(state,'gaze',{leftPupil:'pupilLeft',rightPupil:'pupilRight'},['lookX','lookY']);const mouth=add(state,'mouth',{mouth:'mouth'},['mouthOpen','smile','mouthWidth']);
  if(kind==='expressive'){add(state,'eyes',{leftEye:'eyeLeft',rightEye:'eyeRight'},['eyeOpen']);add(state,'eyelids',{leftUpper:'upperLidLeft',rightUpper:'upperLidRight',leftLower:'lowerLidLeft',rightLower:'lowerLidRight'},['eyeOpen']);add(state,'eyebrows',{leftBrow:'browLeft',rightBrow:'browRight'},['browRaise','browTilt']);add(state,'jaw',{jaw:'jaw'},['jawOpen']);add(state,'hair',{hair:'hair'},['hairSway','hairLift']);state.behaviors=[{id:'blink',type:'blink',name:'Blink',enabled:true,parameter:'eyeOpen',intervalMin:2,intervalMax:6,duration:.12,closedValue:0},{id:'idle-sway',type:'oscillator',name:'Idle',enabled:true,parameter:'lookY',amplitude:.05,frequency:.3,offset:0,waveform:'sine'}];state.animationClips=[clips.look,clips.blink,clips.happy,clips.surprised,clips.nod];}
  else if(kind==='talking'){add(state,'jaw',{jaw:'jaw'},['jawOpen']);state.behaviors=[{id:'blink',type:'blink',name:'Blink',enabled:true,parameter:'eyeOpen',intervalMin:2,intervalMax:6,duration:.12,closedValue:0}];setSemanticControlMethod(state,mouth.id,'mouthOpen','morph');captureSemanticMorph(state,mouth.id,'mouthOpen','neutral',{mouth:'M 80 155 Q 120 165 160 155'});captureSemanticMorph(state,mouth.id,'mouthOpen','open',{mouth:'M 80 155 Q 120 205 160 155'});state.animationClips=[clips.talk];}
  else {state.behaviors=[];state.animationClips=[clips.look,clips.smile];}
  state.animationClips=structuredClone(state.animationClips);state.animationEditor={activeClipId:state.animationClips[0]?.id||null,playhead:0,panel:'preview',autoKey:false};state.selectedId=null;
  return state;
}
