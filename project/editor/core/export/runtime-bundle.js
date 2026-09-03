/**
 * The exported `runtime.js` is a single standalone ES module: a user drops one
 * file next to their page and imports it. The runtime source is nevertheless
 * split into modules so the keyform maths can be unit-tested on its own and
 * shared with the editor rather than duplicated (docs/KEYFORM_ENGINE.md).
 *
 * This joins those modules back into one file. It is a deliberately tiny
 * operation, not a general bundler: the module list is fixed, ordered by
 * dependency, and every module is plain top-level declarations.
 */

/** Runtime modules, in dependency order. Leaf modules first. */
export const RUNTIME_MODULES = Object.freeze(['numeric.js', 'transform-2d.js', 'path-vector.js', 'keyforms.js', 'shape-keys.js', 'hands.js', 'inertia.js', 'mixer.js', 'transitions.js', 'runtime.js']);

const INTERNAL_IMPORT = /^\s*import\s[\s\S]*?from\s*['"]\.\/[^'"]+['"];?[ \t]*$/gm;
const INTERNAL_REEXPORT = /^\s*export\s*\{[\s\S]*?\}\s*from\s*['"]\.\/[^'"]+['"];?[ \t]*$/gm;

/**
 * Drop the statements that tie one runtime module to another. The names they
 * brought in are still declared, because the module that declares them is
 * concatenated into the same file — and still exported, because that module
 * exports them itself.
 */
export function stripInternalModuleLinks(source) {
  return String(source).replace(INTERNAL_REEXPORT, '').replace(INTERNAL_IMPORT, '');
}

/**
 * @param {{ name: string, source: string }[]} modules in dependency order
 * @returns {string} one standalone ES module
 */
export function bundleRuntimeSource(modules = []) {
  const names = modules.map((module) => module.name);
  if (names.join('|') !== RUNTIME_MODULES.join('|')) {
    throw new Error(`Runtime bundle expects ${RUNTIME_MODULES.join(', ')} in that order, received ${names.join(', ') || 'nothing'}.`);
  }
  const stripped = modules.map(({ name, source }) => ({ name, source: stripInternalModuleLinks(source) }));
  assertNoNameCollision(stripped);
  return stripped
    .map(({ name, source }) => `/* ── ${name} ─────────────────────────────────── */\n${source.trim()}\n`)
    .join('\n');
}

const TOP_LEVEL_DECLARATION = /^(?:export\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;

/** Top-level names a module declares, used to prove a concatenation is safe. */
export function topLevelNames(source) {
  return [...String(source).matchAll(TOP_LEVEL_DECLARATION)].map((match) => match[1]);
}

/**
 * Concatenated modules share one scope, and in an ES module a duplicated
 * top-level name is a syntax error. Catching it here turns a broken export into
 * a build-time message naming the two modules and the name.
 */
function assertNoNameCollision(modules) {
  const owner = new Map();
  for (const { name, source } of modules) {
    for (const declared of topLevelNames(source)) {
      const previous = owner.get(declared);
      if (previous) throw new Error(`Runtime modules ${previous} and ${name} both declare "${declared}"; rename one before they can be bundled.`);
      owner.set(declared, name);
    }
  }
}
