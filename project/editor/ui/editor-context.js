export function createEditorContext(initialWorkspace='create') {
  const value={workspace:initialWorkspace,activeSemanticPartId:null,activeControl:null,selectedTrackParameter:null,selectedKey:null,activeStateId:null};
  const listeners=new Set();
  return {
    get:()=>({...value}),
    update(patch){const changed=Object.keys(patch).some(key=>value[key]!==patch[key]);Object.assign(value,patch);if(changed)listeners.forEach(fn=>fn({...value}));},
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
  };
}
