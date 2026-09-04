export function createEditorContext(initialWorkspace='create', store=null) {
  if (store?.getSession) {
    // The shell restores the workspace the author left in; a fresh session
    // starts on the default. Reconciled once, here, because the two used to
    // disagree until the author happened to switch workspace -- and a panel
    // told to leave a workspace it never knew it had entered stays hidden
    // while it is on screen (docs/VNEXT_COMPONENTS.md).
    if (initialWorkspace && store.getSession().workspace !== initialWorkspace) {
      store.mutateSession(['workspace'], (session) => { session.workspace = initialWorkspace; });
    }
    return {
    get:()=>store.getSession(),
    update(patch){store.mutateSession(Object.keys(patch),value=>Object.assign(value,patch));},
    reset(workspace=store.getSession().workspace){store.replaceSession({workspace});},
    subscribe(fn){const stops=Object.keys(store.getSession()).map(key=>store.subscribeSession(key,fn));return()=>stops.forEach(stop=>stop());}
    };
  }
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
