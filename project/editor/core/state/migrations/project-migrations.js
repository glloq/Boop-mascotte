import { canOpenProjectVersion, PROJECT_VERSION, projectVersionOf } from '../project-version.js';

/**
 * Forward migrations for the project file, one rung of the version ladder at
 * a time.
 *
 * **Every rung is declared, including the ones with nothing to do.** A rung
 * that was purely additive still gets an entry saying so, because "no entry"
 * has to mean "someone forgot" -- otherwise a future format that genuinely
 * needs work would load silently and half-right. `projectMigrationLadderGaps`
 * is what turns that rule into a failing test rather than a comment.
 *
 * A step migrates from `from` to `from + 1`: one rung, never two. It receives
 * the snapshot it is to migrate and returns the migrated one; it may mutate
 * what it is given, because it is never given the caller's object.
 */
export const PROJECT_MIGRATIONS = Object.freeze([
  // Both early rungs were additive, and the reader already absorbs them: every
  // field they introduced is defaulted when absent by `applyProjectSnapshot`,
  // which is what lets a file with no `document.editor` at all open as one
  // whose editor block is empty. Nothing to run; the entries are here so the
  // ladder is complete and says why.
  Object.freeze({ from: 1, name: 'v1 to v2: additive, absorbed by the reader', apply: (snapshot) => snapshot }),
  Object.freeze({ from: 2, name: 'v2 to v3: the editor block, defaulted when absent', apply: (snapshot) => snapshot })
]);

/**
 * Where the ladder is broken: a rung with no step, two steps for one rung, a
 * step past the current version, or one that is not a step at all.
 *
 * @returns {string[]} empty when the ladder runs 1 → `PROJECT_VERSION` exactly once each
 */
export function projectMigrationLadderGaps(steps = PROJECT_MIGRATIONS, current = PROJECT_VERSION) {
  const gaps = [], seen = new Map();
  for (const step of steps) {
    if (!Number.isInteger(step?.from) || typeof step?.apply !== 'function' || !step?.name) { gaps.push(`not a step: ${JSON.stringify(step?.name ?? step)}`); continue; }
    if (step.from < 1 || step.from >= current) gaps.push(`step outside the ladder: ${step.name} (version ${step.from} to ${step.from + 1}, current is ${current})`);
    else if (seen.has(step.from)) gaps.push(`two steps for version ${step.from} to ${step.from + 1}: ${seen.get(step.from)} and ${step.name}`);
    else seen.set(step.from, step.name);
  }
  for (let version = 1; version < current; version++) if (!seen.has(version)) gaps.push(`no step for version ${version} to ${version + 1}`);
  return gaps;
}

/**
 * Run an explicit ladder over a snapshot. `migrateProject` is this with the
 * real one; taking the steps as an argument is what lets a test watch a step
 * fail without a registry it has to put back.
 *
 * Nothing the caller owns is touched: the steps run on a copy, and a step that
 * throws fails the whole load rather than leaving a file half-migrated.
 *
 * @returns {{ snapshot: object, from: number, to: number, applied: string[] }}
 */
export function runProjectMigrations(snapshot, steps = PROJECT_MIGRATIONS, current = PROJECT_VERSION) {
  const from = projectVersionOf(snapshot);
  if (!canOpenProjectVersion(from)) throw new Error('Unsupported project snapshot version');
  const due = steps.filter((step) => step.from >= from).sort((a, b) => a.from - b.from);
  if (!due.length) return { snapshot, from, to: from, applied: [] };
  let migrated = structuredClone(snapshot);
  const applied = [];
  for (const step of due) {
    try { migrated = step.apply(migrated) ?? migrated; }
    catch (cause) { throw new Error(`Project migration failed at "${step.name}"; the project was not opened.`, { cause }); }
    applied.push(step.name);
  }
  migrated.version = current;
  return { snapshot: migrated, from, to: current, applied };
}

/** The ladder as it stands, over one snapshot. */
export const migrateProject = (snapshot) => runProjectMigrations(snapshot);
