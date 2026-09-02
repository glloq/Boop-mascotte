export function setPivot(store, elementId, pivotX, pivotY) {
  store.mutateDocument({type:'artwork/set-pivot',source:'rig',domains:['artwork'],apply:(state) => {
    if (!state.elements[elementId]) return;
    state.elements[elementId].baseTransform ||= {};
    state.elements[elementId].baseTransform.pivotX = pivotX;
    state.elements[elementId].baseTransform.pivotY = pivotY;
  }});
}
