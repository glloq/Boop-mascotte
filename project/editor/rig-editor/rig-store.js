export function setPivot(store, elementId, pivotX, pivotY) {
  store.setState((state) => {
    if (!state.elements[elementId]) return;
    state.elements[elementId].baseTransform ||= {};
    state.elements[elementId].baseTransform.pivotX = pivotX;
    state.elements[elementId].baseTransform.pivotY = pivotY;
  });
}
