import { createCleanProjectState } from '../state/store.js';
import { createProjectDocument } from '../state/project-document.js';
import { createEditorSession } from '../state/editor-session.js';
import { applyTemplateProject } from './templates/index.js';
export async function loadProjectTemplate(template,{store,canvas,history,preview,validate=()=>[]}){
  // Canvas parsing builds a plain candidate outside the live store. Subscribers
  // see only the completed document/session pair, never empty or SVG-only state.
  const artwork=await canvas.loadSvgFromText(template.svg, {}, {recordHistory:false,updateStore:false});
  const candidate=Object.assign(createCleanProjectState(),artwork);
  applyTemplateProject(candidate,template.kind);
  const document=createProjectDocument(candidate),session=createEditorSession(candidate);
  store.replaceProject(document,session,{source:`template:${template.kind}`});
  preview.reset();preview.setClip(session.animationEditor.activeClipId);preview.seek(0);
  const state=store.getState();return {state,document,session,issues:validate(state)};
}
