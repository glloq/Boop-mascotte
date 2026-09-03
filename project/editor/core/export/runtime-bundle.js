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
export const RUNTIME_MODULES = Object.freeze(['keyforms.js', 'runtime.js']);

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
  return modules
    .map(({ name, source }) => `/* ── ${name} ─────────────────────────────────── */\n${stripInternalModuleLinks(source).trim()}\n`)
    .join('\n');
}
