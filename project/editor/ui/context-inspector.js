import { resolveSelectionContext } from './selection-context.js';

const EMPTY_COPY = { artwork: 'Select an element on the canvas to edit it.', 'face-setup': 'Select a Face Part to configure it.', animate: 'Select an animation item to edit it.', preview: 'Preview controls are available below.' };

export function createContextInspector(root, editorContext, getTask) {
  const heading = root.querySelector('[data-context-inspector-heading]');
  const empty = root.querySelector('[data-context-inspector-empty]');
  function render() {
    const context = resolveSelectionContext(editorContext.get(), getTask());
    root.hidden = getTask() === 'preview';
    root.dataset.contextKind = context.kind;
    root.dataset.contextId = context.id || context.part || context.parameter || '';
    heading.textContent = context.kind === 'none' ? 'Inspector' : `${context.kind.replaceAll('-', ' ')} Inspector`;
    empty.textContent = context.kind === 'none' ? EMPTY_COPY[getTask()] || '' : '';
    empty.hidden = context.kind !== 'none';
    for (const adapter of root.querySelectorAll('[data-inspector-adapter]')) {
      adapter.hidden = adapter.dataset.inspectorAdapter === 'artwork'
        ? context.kind !== 'artwork'
        : !context.kind.startsWith('semantic-');
    }
    return context;
  }
  return { render };
}
