export function createEditorContext(initialWorkspace='create') {
  const empty=()=>({workspace:initialWorkspace,activeSemanticPartId:null,activeControl:null,selectedTrackParameter:null,selectedKey:null,activeStateId:null,authorMode:'states'});
  const value=empty();
  const listeners=new Set();
  return {
    get:()=>({...value}),
    update(patch){const changed=Object.keys(patch).some(key=>value[key]!==patch[key]);Object.assign(value,patch);if(changed)listeners.forEach(fn=>fn({...value}));},
    reset(workspace=value.workspace){const next={...empty(),workspace};const changed=Object.keys(next).some(key=>value[key]!==next[key]);Object.assign(value,next);if(changed)listeners.forEach(fn=>fn({...value}));},
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
  };
}
