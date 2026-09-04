/**
 * Selectors and ViewModels (VNX-04, docs/VNEXT_ROADMAP.md).
 *
 * `ProjectDocument -> selector -> ViewModel -> component`. The editor renders
 * by asking the store for the document and rebuilding a panel, which is correct
 * and wasteful: moving a hand does not change the face-parts checklist, yet
 * every render recomputed it and rewrote the DOM under it.
 *
 * main.js already grew that fix three times by hand -- `puppetMemo`,
 * `readinessMemo`, `guideMemo`, all the same three lines against
 * `getPersistentRevision()`. This is those three lines written once, plus the
 * other half of the deal: a component still has to decide whether the
 * ViewModel it was handed is the one it already drew.
 *
 * Nothing here knows what a ProjectDocument is; `project-selectors.js` does.
 */

// `undefined` is a legitimate cache entry and a legitimate ViewModel, so
// "nothing computed yet" needs a value no caller is able to pass in.
const NOTHING = Symbol('selector.empty');

const isObject = (value) => value !== null && typeof value === 'object';

/**
 * Memoise a pure computation against a revision token.
 *
 * @param {(...args:any[]) => any} compute
 * @returns {(key:any, ...args:any[]) => any} the same value by identity for as
 *   long as `key` holds, so a caller can decide with `===` whether to render.
 *
 * The key is the whole cache. Arguments are handed to `compute` and never
 * compared, because comparing a whole document is exactly the cost this exists
 * to avoid -- so a caller whose result depends on something the revision does
 * not cover (live preview values, the current selection) has to fold that into
 * the key itself. Keys are compared with `Object.is`, which takes the numeric
 * `getPersistentRevision()`, the `getDocumentVersionToken()` symbol, or a
 * string a caller joined together.
 */
export function createSelector(compute) {
  let key = NOTHING, value;
  const selector = (nextKey, ...args) => {
    // Compute before the key moves: a throwing selector leaves the previous
    // answer in place rather than caching a hole.
    if (!Object.is(key, nextKey)) { value = compute(...args); key = nextKey; }
    return value;
  };
  // A panel that is destroyed (VNX-03) should not keep its last ViewModel, and
  // the document behind it, alive through a module-level selector.
  selector.clear = () => { key = NOTHING; value = undefined; };
  return selector;
}

/**
 * Equal one level down: same kind, same keys, and every value identical.
 *
 * Values are compared with `Object.is`, so two structurally identical nested
 * objects count as different. That is the point -- it is cheap, and a selector
 * that reuses its inner objects keeps it accurate.
 */
export function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (!isObject(a) || !isObject(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  // `hasOwn` and not just the value: `{a: undefined}` and `{b: undefined}` have
  // the same size and the same lookups, and are not the same model.
  return keys.every((key) => Object.hasOwn(b, key) && Object.is(a[key], b[key]));
}

/**
 * Did this ViewModel change? Top level compared key by key, and any value that
 * is itself an object or an array compared key by key too.
 *
 * The honest limit: two levels, and no further. `{steps: [{id, done}]}` is
 * compared down to the step objects and stops there, so a model rebuilt from
 * scratch always reads as changed -- every leaf object is new. That is the
 * right answer for a flat ViewModel (`{loaded, features, core}`) and the wrong
 * one for a deep model such as the handle board. Deep models are not this
 * function's job: give them a selector and compare the result by identity,
 * which costs nothing and is exact.
 */
export function sameModel(a, b) {
  if (Object.is(a, b)) return true;
  if (!isObject(a) || !isObject(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.hasOwn(b, key) && shallowEqual(a[key], b[key]));
}

/**
 * The one question a component asks about the ViewModel it was handed: must I
 * render this?
 *
 * @param {(a:any, b:any) => boolean} [equal] `sameModel` by default; pass
 *   `Object.is` for a model that comes from a selector and is already memoised.
 * @returns {(model:any) => boolean} true the first time, and after that only
 *   when the model differs from the last one that got through.
 */
export function createModelGate(equal = sameModel) {
  let last = NOTHING;
  return (model) => {
    if (last !== NOTHING && equal(last, model)) return false;
    last = model;
    return true;
  };
}
