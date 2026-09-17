/**
 * The version of the project *file* -- `mascot-project.json`, the autosave
 * record, and the `.boop` package that will carry both.
 *
 * It is not `RIG_SCHEMA_VERSION` and it never moves with it. The rig schema
 * says what a rig means; this says what the file around it looks like, and
 * the two change for different reasons: adding a domain to the document is a
 * project change, adding a runtime concept is a rig change
 * (docs/V4_ROADMAP.md, "Two corrections to the frozen values"). Written on
 * every save; a file that carries none is the first format, which never wrote
 * one.
 *
 * **What the number on a file means: the oldest editor that can read it
 * without losing part of it** -- not "what wrote it". A project with no assets
 * is still a version 3 project however new the editor that saved it, and stays
 * openable by one that predates them; a project that carries assets is not,
 * because a version 3 reader drops what it does not know about, silently. One
 * rule, `projectVersionFor`, used everywhere a version is stamped.
 *
 * It lives on the file rather than on `ProjectDocument` on purpose: which
 * format a document was *stored* in is not something the document means, and
 * the document holds nothing that is not authored (docs/V3_ROADMAP.md, the
 * cross-cutting invariant). It sits in its own module so that the package
 * writer and the migration ladder can ask what the current version is without
 * reaching through the snapshot reader.
 */
export const PROJECT_VERSION = 5;

/** The version a file declares, or 1 for the format that declared none. */
export const projectVersionOf = (snapshot) => snapshot?.version ?? 1;

/**
 * Whether this editor can open a file of that version at all.
 *
 * Below `PROJECT_VERSION` is a file to migrate forward. Above it is a file a
 * newer editor wrote, whose meaning this one cannot invent -- so it declines
 * rather than guesses. One predicate, because the answer was written out
 * twice and a third format would have had to remember both.
 */
export const canOpenProjectVersion = (version) => Number.isInteger(version) && version >= 1 && version <= PROJECT_VERSION;

/**
 * The oldest version that can read this document without losing part of it.
 *
 * Every version above the first is a block a younger reader would drop on the
 * floor: version 4 is the asset table, version 5 the meshes that deform a
 * picture. A document that uses none of them is honestly still the older
 * format, and saying so is what keeps a project that gained nothing new
 * openable by an editor that gained nothing new.
 *
 * Highest first, because a project carrying both needs the reader that knows
 * about both.
 */
export function projectVersionFor(document) {
  if ((document?.rig?.meshes || document?.meshes || []).length) return 5;
  if (Object.keys(document?.assets || {}).length) return 4;
  return 3;
}
