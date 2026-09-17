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
 * It lives on the file rather than on `ProjectDocument` on purpose: which
 * format a document was *stored* in is not something the document means, and
 * the document holds nothing that is not authored (docs/V3_ROADMAP.md, the
 * cross-cutting invariant). It sits in its own module so that the package
 * writer and the migration ladder can ask what the current version is without
 * reaching through the snapshot reader.
 */
export const PROJECT_VERSION = 3;

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
