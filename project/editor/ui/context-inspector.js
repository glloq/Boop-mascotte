import { resolveSelectionContext } from './selection-context.js';

const EMPTY_COPY = { artwork: 'Select an element on the canvas to edit it.', 'face-setup': 'Select a Face Part to configure it.', expressions: 'Select an expression or create one.', animate: 'Add a motion preset or select an animation to edit it.', preview: 'Preview controls are available below.' };

const CONTEXT_HEADINGS = {
  artwork: 'Artwork Inspector',
  'semantic-part': 'Face Part Inspector',
  'semantic-control': 'Movement Inspector',
  expression: 'Expression Inspector',
  clip: 'Motion Inspector',
  'timeline-key': 'Motion Inspector',
  'timeline-track': 'Motion Inspector',
  state: 'State Inspector',
  none: 'Inspector'
};

export function resolveInspectorPresentation(task, context) {
  const hidden = task === 'preview';
  const semantic = task === 'face-setup' && (context.kind === 'none' || context.kind.startsWith('semantic-'));
  const expression = task === 'expressions' && (context.kind === 'none' || context.kind === 'expression');
  const motion = task === 'animate' && ['clip', 'timeline-track', 'timeline-key'].includes(context.kind);
  return {
    hidden,
    heading: CONTEXT_HEADINGS[context.kind] || 'Inspector',
    emptyCopy: context.kind === 'none' && !semantic && !expression ? EMPTY_COPY[task] || '' : '',
    artwork: context.kind === 'artwork',
    semantic,
    expression,
    motion
  };
}

export function createContextInspector(root, editorContext, getTask) {
  const heading = root.querySelector('[data-context-inspector-heading]');
  const empty = root.querySelector('[data-context-inspector-empty]');
  function render() {
    const task = getTask();
    const context = resolveSelectionContext(editorContext.get(), task);
    const presentation = resolveInspectorPresentation(task, context);
    root.hidden = presentation.hidden;
    root.dataset.contextKind = context.kind;
    root.dataset.contextId = context.id || context.part || context.parameter || '';
    heading.textContent = presentation.heading;
    empty.textContent = presentation.emptyCopy;
    empty.hidden = !presentation.emptyCopy;
    for (const adapter of root.querySelectorAll('[data-inspector-adapter]')) {
      const kind = adapter.dataset.inspectorAdapter;
      adapter.hidden = kind === 'artwork' ? !presentation.artwork : kind === 'expression' ? !presentation.expression : kind === 'motion' ? !presentation.motion : !presentation.semantic;
    }
    return context;
  }
  return { render };
}
