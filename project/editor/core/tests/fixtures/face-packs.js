import { ANIMAL_FACE_PARTS } from '../../face-library/builtin/animals/index.js';
import { ROBOT_FACE_PARTS } from '../../face-library/builtin/robots/index.js';
import { BIRD_FACE_PARTS } from '../../face-library/builtin/birds/index.js';

/**
 * The packs the library ships, and what each of them narrows to.
 *
 * This file exists because of a pattern three milestones long. MASC-10B added
 * the animals, MASC-11B the robots and MASC-12B the birds, and each time the
 * *same* half-dozen assertions had to be edited — "exactly the animal pack
 * narrows", "the library is 92 drawings", "a monster face sees everything the
 * animals do not take". None of those tests was wrong; they were written
 * against a library with one pack in it, and had to be re-read by hand each
 * time a second and a third arrived.
 *
 * So the list lives here once. A fourth pack adds one entry, and every test
 * that asks "which drawings narrow, and to what" follows without being edited.
 * What a test still spells out for itself is anything *particular* to its pack
 * — the robot pack's missing jaw, the bird pack's two-mandible beak — because
 * that is the part a shared fixture would hide rather than help.
 *
 * ```text
 * animals  muzzle  45  MASC-10B
 * robots   robot   28  MASC-11B
 * birds    beak    30  MASC-12B, of which one is universal
 * ```
 */
export const FACE_PACKS = Object.freeze([
  Object.freeze({ id: 'animals', morphology: 'muzzle', milestone: 'MASC-10B', parts: ANIMAL_FACE_PARTS }),
  Object.freeze({ id: 'robots', morphology: 'robot', milestone: 'MASC-11B', parts: ROBOT_FACE_PARTS }),
  Object.freeze({ id: 'birds', morphology: 'beak', milestone: 'MASC-12B', parts: BIRD_FACE_PARTS })
]);

/** How many drawings the library held before any pack arrived (PR 6, phase 45). */
export const HUMAN_LIBRARY_SIZE = 47;

/** Every id any pack ships, universal pieces included. */
export const PACKED_IDS = Object.freeze(new Set(FACE_PACKS.flatMap((pack) => pack.parts.map((asset) => asset.id))));

/**
 * Every id that **narrows**, and the one kind of face it narrows to.
 *
 * Not the same as `PACKED_IDS`: a pack may ship a universal drawing, and the
 * bird pack does — `accessory.monocle` suits a person as readily as an owl, so
 * it declares no `morphologies` and is not in here. That distinction is the
 * whole reason this is derived from the assets rather than from the pack list.
 */
export const NARROWED = Object.freeze(new Map(FACE_PACKS.flatMap((pack) =>
  pack.parts.filter((asset) => asset.morphologies?.length).map((asset) => [asset.id, pack.morphology]))));

/** The ids a face of `morphology` is **not** offered: every other pack's own. */
export const hiddenFrom = (morphology) => [...NARROWED].filter(([, kind]) => kind !== morphology).map(([id]) => id);

/** Whether an id is one the packs narrowed. */
export const isNarrowed = (id) => NARROWED.has(id);
