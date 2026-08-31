import { createCleanProjectState } from '../state/store.js';
import { applyTemplateProject } from './templates/index.js';
export async function loadProjectTemplate(template,{store,canvas,history,preview,validate=()=>[]}){
  preview.stop();preview.reset();store.replaceState(createCleanProjectState());await canvas.loadSvgFromText(template.svg);store.setState((state)=>applyTemplateProject(state,template.kind));const state=store.getState();preview.setClip(state.animationEditor.activeClipId);preview.seek(0);history.clear?.();return {state,issues:validate(state)};
}
