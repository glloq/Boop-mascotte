/**
 * The one inspector, and what it is showing right now.
 *
 * The right-hand panel is a single section with five adapters inside it
 * (artwork, semantic, expression, motion, reaction). This decides which one is
 * on, what the heading says, and what the empty line says — when nothing is
 * picked, and equally when what is picked has no adapter of its own, because a
 * heading over an empty column is the failure VNX-11 is about. It owns no
 * project data: it reads the selection context and writes attributes.
 *
 * Behind the component lifecycle since VNX-03 step 3 (docs/VNEXT_COMPONENTS.md),
 * and the reason that step exists on its own: `render()` returns a value the
 * editor reads — `workspace-manager.js` needs the context to decide whether a
 * phone should reveal the sheet, and `e2e-hooks.js` exposes it as
 * `selectionContext()`. The contract's `update()` returns whether it rendered,
 * which is a different question, so the public `render()` keeps its own return
 * path: the context is resolved first, handed to the component, and returned
 * whether the component drew anything or skipped.
 *
 * Two sharp edges, both written down rather than papered over:
 *
 * - `host.hidden` has two owners here. The component treats it as lifecycle,
 *   this panel treats it as content (`preview` has no inspector). They do not
 *   collide today because the panel's write happens inside the render the
 *   component asks for, i.e. always after `syncHidden`, and nothing ever calls
 *   `hide()` on it. It is the same collision `guide-bar` has.
 * - `destroy()` empties the host, and this host is the shell's own markup: the
 *   heading, the empty line and the five adapter containers, three of which are
 *   *other* panels' hosts (`#rig-panel`, `#inspector`). Destroying this one
 *   takes them with it. It is here for VNX-56 to call deliberately, never as
 *   part of tearing down a workspace.
 */
import { resolveSelectionContext } from './selection-context.js';
import { createComponent } from './component.js';

const EMPTY_COPY = { artwork: 'Select an element on the canvas to edit it.', 'face-setup': 'Select a Face Part to configure it.', expressions: 'Select an expression or create one.', reactions: 'Select a reaction or create one.', animate: 'Add a motion preset or select an animation to edit it.', preview: 'Preview controls are available below.' };

const CONTEXT_HEADINGS = {
  artwork: 'Artwork Inspector',
  'semantic-part': 'Face Part Inspector',
  'semantic-control': 'Movement Inspector',
  expression: 'Expression Inspector',
  reaction: 'Reaction Inspector',
  clip: 'Motion Inspector',
  'timeline-key': 'Motion Inspector',
  'timeline-track': 'Motion Inspector',
  state: 'State Inspector',
  none: 'Inspector'
};

/** What the author picked, in their words, for the line that has to name it. */
const KIND_NOUNS = {
  artwork: 'piece of artwork',
  'semantic-part': 'face part',
  'semantic-control': 'movement',
  expression: 'expression',
  reaction: 'reaction',
  clip: 'motion',
  'timeline-track': 'track',
  'timeline-key': 'keyframe',
  state: 'state'
};

/**
 * The line shown when something *is* selected and no adapter answers for it.
 *
 * A heading with an empty column under it reads as a panel that failed to
 * load, and it is the one thing a selection-driven inspector must never do
 * (VNX-11): the author picked a thing, so the panel owes them its name and
 * where it is edited. Entries here name the selection rather than the task,
 * because the task is not what was just clicked.
 */
const UNADAPTED_COPY = {
  // The state machine is Advanced and draws itself into the left column, so
  // this is a signpost rather than an apology: there is an editor for a state,
  // it is simply not in this panel.
  state: (context) => `State “${context.id}” is edited in the State machine, in the left column.`
};

/** Name the selection even when only its id is known. */
function describeSelection(context) {
  const specific = UNADAPTED_COPY[context.kind]?.(context);
  if (specific) return specific;
  const name = context.id || context.parameter || context.part || '';
  const noun = KIND_NOUNS[context.kind] || 'selection';
  return name ? `The ${noun} “${name}” has no editor in this panel yet.` : `That ${noun} has no editor in this panel yet.`;
}

export function resolveInspectorPresentation(task, context) {
  const hidden = task === 'preview';
  const semantic = task === 'face-setup' && (context.kind === 'none' || context.kind.startsWith('semantic-'));
  const expression = task === 'expressions' && (context.kind === 'none' || context.kind === 'expression');
  const motion = task === 'animate' && ['clip', 'timeline-track', 'timeline-key'].includes(context.kind);
  const reaction = task === 'reactions' && (context.kind === 'none' || context.kind === 'reaction');
  const artwork = context.kind === 'artwork';
  // One question decides the empty line: is any adapter on? Nothing selected
  // gets the task's invitation, a selection nobody adapts gets named, and an
  // adapter that is on says the rest itself.
  const adapted = artwork || semantic || expression || motion || reaction;
  return {
    hidden,
    heading: CONTEXT_HEADINGS[context.kind] || 'Inspector',
    emptyCopy: adapted ? '' : context.kind === 'none' ? EMPTY_COPY[task] || '' : describeSelection(context),
    artwork,
    semantic,
    expression,
    motion,
    reaction
  };
}

export function createContextInspector(root, editorContext, getTask) {
  const heading = root.querySelector('[data-context-inspector-heading]');
  const empty = root.querySelector('[data-context-inspector-empty]');

  const component = createComponent({
    host: root,
    render: (model) => {
      root.hidden = model.hidden;
      root.dataset.contextKind = model.kind;
      root.dataset.contextId = model.contextId;
      heading.textContent = model.heading;
      empty.textContent = model.emptyCopy;
      empty.hidden = !model.emptyCopy;
      for (const adapter of root.querySelectorAll('[data-inspector-adapter]')) {
        const kind = adapter.dataset.inspectorAdapter;
        adapter.hidden = kind === 'artwork' ? !model.artwork : kind === 'expression' ? !model.expression : kind === 'motion' ? !model.motion : kind === 'reaction' ? !model.reaction : !model.semantic;
      }
    }
  });

  /**
   * Flat on purpose: this is what the component compares to decide to redraw.
   *
   * The presentation is already a flat bag of primitives, and every one of its
   * fields is written by the render above, so it is spread in whole rather than
   * copied field by field: a field added to `resolveInspectorPresentation` and
   * used in the markup then arrives in the comparison by itself. The two the
   * context adds are the two attributes the sheet and the tests read back.
   */
  const model = (task, context) => ({
    ...resolveInspectorPresentation(task, context),
    kind: context.kind,
    contextId: context.id || context.part || context.parameter || ''
  });

  /** @returns {object} what the inspector is showing — rendered or skipped. */
  function render() {
    const task = getTask();
    const context = resolveSelectionContext(editorContext.get(), task);
    const next = model(task, context);
    if (component.isMounted()) component.update(next); else component.mount(next);
    return context;
  }

  return { render, destroy: () => component.destroy(), counters: () => component.counters() };
}
