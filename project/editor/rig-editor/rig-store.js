export function setPivot(store, elementId, pivotX, pivotY) {
  store.setState((state) => {
    if (!state.elements[elementId]) return;
    state.elements[elementId].pivotX = pivotX;
    state.elements[elementId].pivotY = pivotY;
  });
}
