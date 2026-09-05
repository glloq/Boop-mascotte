/**
 * What happens when the editor's context changes (VNX-02, docs/VNEXT_ROADMAP.md).
 *
 * The domain fan-out became a table in VNX-05; this is the same problem one
 * level up. A context change — a different workspace, a different selected
 * part, a different control — used to run a single dense closure in `main.js`
 * that re-rendered ten panels, told three of them they were entering or
 * leaving, and then decided whether to slide the inspector into view on a
 * phone. Three unrelated jobs in one line nobody could read.
 *
 * They are three jobs here, and the first two are data. The third is the one
 * that actually needed writing down: revealing the inspector has a rule with
 * four clauses, and getting it wrong means the sheet either never appears or
 * appears every time the author touches anything.
 *
 * Enter/leave is the shape `show()` / `hide()` replaces (docs/VNEXT_COMPONENTS.md):
 * when every panel is a component, `WORKSPACE_OCCUPANTS` becomes the argument
 * to a lifecycle call rather than a lookup table.
 */
import { RENDER_TARGETS } from '../core/state/render-plan.js';

/**
 * Panels that care whether their own workspace is the one showing.
 *
 * `onLeave` runs when the context moves somewhere else; `onEnter` when it
 * arrives. A panel with only `onLeave` has nothing to do on the way in.
 */
export const WORKSPACE_OCCUPANTS = Object.freeze({
  rigPanel: Object.freeze({ workspace: 'rig', onLeave: 'cancelTransient' }),
  faceSetup: Object.freeze({ workspace: 'rig', onLeave: 'cancelTransient' }),
  expressionStudio: Object.freeze({ workspace: 'expressions', onEnter: 'enter', onLeave: 'leave' }),
  reactionStudio: Object.freeze({ workspace: 'reactions', onLeave: 'leave' })
});

/** Redrawn on every context change, in this order. */
export const CONTEXT_RENDER_PLAN = Object.freeze(['rigPanel', 'faceSetup', 'faceMovements', 'headPose',
  // `states` reads `authorMode` from the context: a deep link that set it used
  // to leave the States editor on whatever mode it last drew.
  'handSetup', 'warpPanel', 'expressionStudio', 'motionStudio', 'reactionStudio', 'timeline', 'states']);

/**
 * Should the inspector slide into view?
 *
 * Only on a compact layout, only when the author picked something rather than
 * changed workspace, and only when what they picked is different from last
 * time. Switching workspace already shows its own panel, so revealing the
 * sheet on top of it takes the screen away from the thing just opened; and
 * re-revealing on an unchanged selection makes the sheet fight every click.
 */
export function shouldRevealInspector({ switchedWorkspace, compact, kind, key, lastKey }) {
  return Boolean(!switchedWorkspace && compact && kind && kind !== 'none' && key !== lastKey);
}

/** The identity of what the inspector is showing, for comparing one to the next. */
export const inspectorKey = (context = {}) =>
  `${context.kind || 'none'}:${context.id || context.part || context.parameter || ''}`;

/**
 * @param {object} options
 * @param {Record<string, object>} options.panels    the panel objects, by target name
 * @param {Record<string, () => void>} options.targets  the render jobs, by target name
 * @param {() => object} options.renderInspector      returns what the inspector is showing
 * @param {(text: string) => void} options.setSheetSubject
 * @param {() => boolean} options.isCompact
 * @param {() => void} options.revealInspector
 * @param {() => string} options.inspectorHeading     the heading text the sheet borrows
 */
export function createWorkspaceManager({
  panels = {}, targets = {}, renderInspector, setSheetSubject = () => {},
  isCompact = () => false, revealInspector = () => {}, inspectorHeading = () => ''
} = {}) {
  const missing = CONTEXT_RENDER_PLAN.filter((name) => typeof targets[name] !== 'function');
  if (missing.length) throw new Error(`Workspace manager is missing render targets: ${missing.join(', ')}`);
  const unknown = CONTEXT_RENDER_PLAN.filter((name) => !RENDER_TARGETS.includes(name));
  if (unknown.length) throw new Error(`Context plan names targets the render plan does not know: ${unknown.join(', ')}`);

  let lastWorkspace = null, lastKey = null;

  return {
    /** One context change, in three steps: tell, draw, reveal. */
    apply(context = {}) {
      for (const [name, occupant] of Object.entries(WORKSPACE_OCCUPANTS)) {
        const panel = panels[name];
        const method = context.workspace === occupant.workspace ? occupant.onEnter : occupant.onLeave;
        if (method && typeof panel?.[method] === 'function') panel[method]();
      }
      for (const name of CONTEXT_RENDER_PLAN) targets[name]();

      const inspector = renderInspector?.() || {};
      setSheetSubject(context.workspace === 'preview' ? 'Preview' : inspectorHeading());

      const switchedWorkspace = context.workspace !== lastWorkspace;
      lastWorkspace = context.workspace;
      const key = inspectorKey(inspector);
      if (shouldRevealInspector({ switchedWorkspace, compact: isCompact(), kind: inspector.kind, key, lastKey })) revealInspector();
      lastKey = key;
      return inspector;
    }
  };
}
