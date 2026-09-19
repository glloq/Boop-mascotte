/**
 * Which inspector answers for what is selected (UIR-03, §5 Règle B of
 * docs/UIR_REFACTOR_BASELINE.md).
 *
 * The rule the refactor is built on:
 *
 * ```text
 * panels on screen + selection = inspector
 * ```
 *
 * and never "which historical panel happens to be visible". It used to be a
 * chain of six booleans, one per adapter, each repeating the same shape with a
 * different pair of names:
 *
 * ```js
 * const semantic = task === 'face-setup' && (context.kind === 'none' || context.kind.startsWith('semantic-'));
 * const expression = task === 'expressions' && (…);
 * ```
 *
 * A seventh adapter meant a seventh boolean, a seventh clause in `adapted`, and
 * a seventh branch in the renderer's ternary. It is a table now: an adapter
 * says where it answers and what it adapts, and everything else is derived.
 *
 * Pure data and pure functions; no DOM. The renderer is `context-inspector.js`.
 */

/**
 * The subjects a column can be about -- what `selection-context.js` resolves a
 * surface to. Not the route: `rig.assign` and `rig.controls` are two screens
 * over one column of panels, and a face part is a face part on both.
 */

/**
 * @typedef {object} InspectorAdapter
 * @property {string} id        the `data-inspector-adapter` value in the shell
 * @property {string[]|null} subjects  the columns it answers on; `null` is all of them
 * @property {string[]} except  columns it stands down on even when it would answer
 * @property {string[]|null} kinds  the selection kinds it adapts; `null` is all of them
 */

/**
 * In order. The first adapter that answers decides the heading when it wants
 * one of its own.
 *
 * `character` was first and is gone (V5-07): the Character Builder's inspector
 * answered for its whole column, selection or not, and was the reason Artwork's
 * adapter carried an `except`. Nothing stands Artwork down any more.
 */
export const INSPECTOR_ADAPTERS = Object.freeze([
  // Artwork follows the selection rather than the column: a piece of artwork
  // picked anywhere is edited the same way.
  Object.freeze({ id: 'artwork', subjects: null, except: [], kinds: ['artwork'] }),
  Object.freeze({ id: 'semantic', subjects: ['face-setup'], except: [], kinds: ['none', 'semantic-part', 'semantic-control'] }),
  Object.freeze({ id: 'expression', subjects: ['expressions'], except: [], kinds: ['none', 'expression'] }),
  Object.freeze({ id: 'motion', subjects: ['animate'], except: [], kinds: ['clip', 'timeline-track', 'timeline-key'] }),
  Object.freeze({ id: 'reaction', subjects: ['reactions'], except: [], kinds: ['none', 'reaction'] }),
  // The Behavior board's own picks (docs/BEHAVIOR_STUDIO.md). It answers *after*
  // `reaction` so a reaction keeps its sentence editor, and for the three kinds
  // that had no editor in this column at all: a state was answered with a line
  // saying where its editor was, and a transition and an automatic behaviour
  // were not selections the column had ever heard of.
  Object.freeze({ id: 'behavior', subjects: ['reactions'], except: [], kinds: ['state', 'transition', 'automatic', 'trigger'] })
]);

/** Columns with no inspector at all: Preview is the mascot, not a panel over it. */
export const INSPECTOR_HIDDEN_SUBJECTS = Object.freeze(['preview']);

/** Every adapter id, for the renderer to switch off the ones that did not answer. */
export const INSPECTOR_IDS = Object.freeze(INSPECTOR_ADAPTERS.map((adapter) => adapter.id));

const answers = (adapter, subject, kind) =>
  !adapter.except.includes(subject)
  && (adapter.subjects === null || adapter.subjects.includes(subject))
  && (adapter.kinds === null || adapter.kinds.includes(kind));

/**
 * The adapters on, for a column and a selection.
 *
 * @param {string} subject what the panels on screen are about
 * @param {string} kind    what is selected, `'none'` when nothing is
 * @returns {{on: Set<string>, first: InspectorAdapter|null, hidden: boolean}}
 */
export function resolveInspectorAdapters(subject, kind) {
  const matched = INSPECTOR_ADAPTERS.filter((adapter) => answers(adapter, subject, kind));
  return {
    on: new Set(matched.map((adapter) => adapter.id)),
    first: matched[0] || null,
    hidden: INSPECTOR_HIDDEN_SUBJECTS.includes(subject)
  };
}
