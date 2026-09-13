/**
 * The brief for the first animal faces (MASC-10A; docs/MUZZLE_SOFT_CARTOON_PILOT.md).
 *
 * ```text
 * morphology   muzzle
 * style        soft-cartoon — the style the library is drawn in
 * species      Cat · Dog · Fox · Bear
 * ```
 *
 * **Nothing here is a face part, and nothing here is registered.** This is a
 * data-only cahier des charges: what has to be drawn, what must not be drawn
 * twice, which slot and anchor each piece uses, which of the 47 shipped
 * drawings can be reused instead, and which of the four recipes each piece is
 * in. `BUILTIN_FACE_PARTS` and `FACE_PRESET_LIBRARY` are untouched, and
 * `npm run face:assets` still reviews the 47 that really exist.
 *
 * The rule the whole file exists to enforce:
 *
 * ```text
 * shared parts  +  species-specific parts  +  preset recipe
 * ```
 *
 * Four species are **not** four libraries. A cat and a bear share a head, a
 * pair of eyes and a brow; what makes them a cat and a bear is the ears, the
 * muzzle, the nose and the palette. Nineteen drawings make four animals, and
 * four more come free from the shelf.
 *
 * Every id below is a *proposal*. MASC-10B draws them, runs each through
 * `npm run face:assets` (docs/FACE_ASSET_AUTHORING.md), and registers what
 * survives.
 */
import { FACE_BASE_STYLE_ID } from '../face-styles.js';

export const PILOT_ID = 'muzzle-soft-cartoon';
export const PILOT_MORPHOLOGY = 'muzzle';
export const PILOT_STYLE = FACE_BASE_STYLE_ID;

/** The species the pilot dresses. Each is a **preset inside `muzzle`**, never a morphology. */
export const PILOT_SPECIES = Object.freeze(['cat', 'dog', 'fox', 'bear']);

/**
 * Where a planned drawing is between "somebody should draw this" and "the
 * library has it". Pilot vocabulary only: no face part carries it, and nothing
 * in the editor reads it.
 */
export const PILOT_STATUSES = Object.freeze(['needs-art', 'candidate', 'approved', 'rejected']);

/** The order the validation sheets are drawn in, coarse to fine (MASC-10A §23). */
export const PILOT_REVIEW_GROUPS = Object.freeze(['heads', 'eyes', 'pupils', 'brows', 'ears', 'muzzles', 'noses', 'mouths', 'whiskers']);

/**
 * What an existing drawing is worth to this pilot (MASC-10A §14).
 *
 * ```text
 * reuse           a recipe names it: nothing is drawn for that role
 * possible-reuse  it may work; the first sheet decides
 * replace         an animal needs its own, and this one cannot stand in
 * not-relevant    nothing in this pilot would ever reach for it
 * ```
 */
export const PILOT_REUSE_VERDICTS = Object.freeze(['reuse', 'possible-reuse', 'replace', 'not-relevant']);

const asset = (entry) => Object.freeze({
  species: Object.freeze([]), tags: Object.freeze([]), capabilities: Object.freeze([]),
  morphologies: Object.freeze([PILOT_MORPHOLOGY]), priority: 'pilot', status: 'needs-art',
  // Which drawings put this on the face, when it is not a card of its own.
  // The pupils are the only case, and the reason is below.
  drawnBy: Object.freeze([]), distinct: '', turn: 'category-default', notes: '',
  ...entry,
  drawnBy: Object.freeze([...(entry.drawnBy || [])]),
  tags: Object.freeze([...(entry.tags || [])]), species: Object.freeze([...(entry.species || [])]),
  capabilities: Object.freeze([...(entry.capabilities || [])]), requiredRoles: Object.freeze([...(entry.requiredRoles || [])]),
  morphologies: Object.freeze([...(entry.morphologies || [PILOT_MORPHOLOGY])])
});

const ORDER = Object.fromEntries(PILOT_REVIEW_GROUPS.map((group, index) => [group, (index + 1) * 10]));
let seen = {};
const inGroup = (group) => { seen[group] = (seen[group] || 0) + 1; return ORDER[group] + seen[group]; };

/**
 * The drawings the pilot needs, in the order they are reviewed.
 *
 * Nineteen, and every one of them is in at least one recipe. Where a shipped
 * drawing does the job it is named in the recipe instead and no entry appears
 * here — that is what keeps the count at nineteen rather than twenty-five.
 */
export const PILOT_ASSETS = Object.freeze([
  /* ── Heads ─────────────────────────────────────────────────────────────
   * Two, and neither replaces the eight human skulls: an animal face is a
   * different set of proportions, not a better oval. They are declared for
   * `muzzle` only, so Design offers them when an author is making an animal
   * and never when they are making a person.
   */
  asset({
    id: 'head.animal-round', proposedName: 'Animal round', reviewGroup: 'heads', reviewOrder: inGroup('heads'),
    slot: 'head', category: 'head', mountPoint: 'head.center', requiredRoles: ['head'],
    capabilities: ['headX', 'headY', 'headTilt'],
    tags: ['animal', 'round', 'soft'], species: ['cat', 'dog', 'bear'],
    direction: 'Round skull, soft cheeks, a short lower face and a large forehead.',
    distinct: 'Rounder and shorter in the lower face than animal-narrow.',
    notes: 'The fit matrix should compare it against head.round: if the difference does not read, drop it and reuse the human one.'
  }),
  asset({
    id: 'head.animal-narrow', proposedName: 'Animal narrow', reviewGroup: 'heads', reviewOrder: inGroup('heads'),
    slot: 'head', category: 'head', mountPoint: 'head.center', requiredRoles: ['head'],
    capabilities: ['headX', 'headY', 'headTilt'],
    tags: ['animal', 'narrow', 'sharp'], species: ['fox'],
    direction: 'Slightly longer, a narrower lower face, sharper cheeks.',
    distinct: 'Longer and narrower below the eyes than animal-round.'
  }),

  /* ── Eyes, and the pupils inside them ──────────────────────────────────
   * The finding that shapes this whole section: **a pair of eyes in this
   * library draws its own pupils.** Every one of the five shipped eye sets is
   * a composite that names `gaze` and `eyelids` under `parts`, there has never
   * been a standalone pupils card, and `PRESET_PART_ORDER` does not let a
   * preset name one — so a Cat preset could not put vertical pupils on a face
   * even if the card existed.
   *
   * So two eye families times two pupil families is not four drawings, it is
   * the combinations any recipe actually asks for, which is three:
   *
   * ```text
   * cartoon-large       round pupils     dog · bear
   * cartoon-large-slit  vertical pupils  cat
   * alert-almond        round pupils     fox
   * ```
   *
   * Almond with vertical pupils — an alert cat — is the fourth, and nobody
   * needs it yet. It is a drawing, not a decision, whenever somebody does.
   */
  asset({
    id: 'eyes.cartoon-large', proposedName: 'Cartoon large', reviewGroup: 'eyes', reviewOrder: inGroup('eyes'),
    slot: 'eyes', category: 'eyes', mountPoint: 'eyes', requiredRoles: ['leftEye', 'rightEye'],
    capabilities: ['eyeOpen'], tags: ['animal', 'large', 'friendly'], species: ['dog', 'bear'],
    direction: 'Big round friendly eyes, round pupils, a glint.',
    distinct: 'Round pupils, where cartoon-large-slit has vertical ones.',
    notes: 'Composite: also draws the gaze (leftPupil, rightPupil) and the eyelids, as every shipped eye set does.'
  }),
  asset({
    id: 'eyes.cartoon-large-slit', proposedName: 'Cartoon large, slit', reviewGroup: 'eyes', reviewOrder: inGroup('eyes'),
    slot: 'eyes', category: 'eyes', mountPoint: 'eyes', requiredRoles: ['leftEye', 'rightEye'],
    capabilities: ['eyeOpen'], tags: ['cat', 'feline', 'large', 'slit'], species: ['cat'],
    direction: 'The same big round eye, with a vertical slit pupil.',
    distinct: 'Vertical pupils, where cartoon-large has round ones.',
    notes: 'The whole difference is the pupil geometry; the socket, the lids and their drivers are cartoon-large\'s.'
  }),
  asset({
    id: 'eyes.alert-almond', proposedName: 'Alert almond', reviewGroup: 'eyes', reviewOrder: inGroup('eyes'),
    slot: 'eyes', category: 'eyes', mountPoint: 'eyes', requiredRoles: ['leftEye', 'rightEye'],
    capabilities: ['eyeOpen'], tags: ['animal', 'almond', 'alert'], species: ['fox'],
    direction: 'Almond eyes tilted up at the outer corner: awake rather than sweet.',
    distinct: 'Almond and tilted, where the cartoon-large family is round.'
  }),

  /* ── Pupils ────────────────────────────────────────────────────────────
   * Two families and **no drawings of their own**: each is a property of the
   * eye set that draws it. They are listed so the validation sheet has a
   * Pupils page — the pupil is where a cat stops being a dog, and it deserves
   * looking at on its own even though it is not a card.
   */
  asset({
    id: 'pupils.round', proposedName: 'Round pupils', reviewGroup: 'pupils', reviewOrder: inGroup('pupils'),
    slot: 'pupils', category: 'pupils', mountPoint: 'eyes', requiredRoles: ['leftPupil', 'rightPupil'],
    capabilities: ['lookX', 'lookY', 'pupilScale'], tags: ['animal', 'round'], species: ['dog', 'fox', 'bear'],
    drawnBy: ['eyes.cartoon-large', 'eyes.alert-almond'], standalone: false,
    direction: 'A plain round pupil with a glint, as the shipped eyes have.',
    distinct: 'Round, where pupils.vertical is a slit.',
    notes: 'Reviewed as part of the eye sets that draw it: it has no card, and no preset names it.'
  }),
  asset({
    id: 'pupils.vertical', proposedName: 'Vertical pupils', reviewGroup: 'pupils', reviewOrder: inGroup('pupils'),
    slot: 'pupils', category: 'pupils', mountPoint: 'eyes', requiredRoles: ['leftPupil', 'rightPupil'],
    capabilities: ['lookX', 'lookY', 'pupilScale'], tags: ['cat', 'feline', 'slit', 'vertical'], species: ['cat'],
    drawnBy: ['eyes.cartoon-large-slit'], standalone: false,
    direction: 'A tall slit pupil, narrow at rest.',
    distinct: 'A slit, where pupils.round is round.',
    notes: 'Must keep the gaze working: lookX, lookY and pupilScale drive it exactly as they drive a round pupil.'
  }),

  /* ── Brows ─────────────────────────────────────────────────────────────
   * One drawing. `eyebrows.thin` is already a thin arc above the eye and works
   * unchanged on an animal, so the soft family is a reuse and only the fox's
   * sharper brow is drawn.
   */
  asset({
    id: 'eyebrows.animal-sharp', proposedName: 'Animal sharp', reviewGroup: 'brows', reviewOrder: inGroup('brows'),
    slot: 'eyebrows', category: 'eyebrows', mountPoint: 'brows', requiredRoles: ['leftBrow', 'rightBrow'],
    capabilities: ['browRaise', 'browTilt'], tags: ['animal', 'sharp', 'alert'], species: ['fox'],
    direction: 'An angled brow, higher at the outer end: alert, a little sly.',
    distinct: 'Angled, where the reused eyebrows.thin is a soft arc.'
  }),

  /* ── Ears ──────────────────────────────────────────────────────────────
   * The first slot that really says which animal this is, and the only group
   * where four drawings are worth it: the same head with the same eyes reads
   * as a different creature when the ears change.
   *
   * All four sit **on top of the skull**, where the three shipped pairs sit at
   * its sides. That is the one geometric departure in the pilot, and the fit
   * matrix across Round, Narrow, Wide and Square is what has to bless it.
   */
  asset({
    id: 'ears.cat-pointed', proposedName: 'Cat pointed', reviewGroup: 'ears', reviewOrder: inGroup('ears'),
    slot: 'ears', category: 'ears', mountPoint: 'ears', requiredRoles: ['leftEar', 'rightEar'],
    capabilities: ['earWiggle'], tags: ['cat', 'feline', 'pointed'], species: ['cat'],
    direction: 'Two upright triangles on top of the skull, with an inner ear.',
    distinct: 'Upright and small, where the fox\'s are large and swept.',
    turn: 'needs-profile', notes: 'On top of the head, unlike every shipped ear pair.'
  }),
  asset({
    id: 'ears.fox-large-pointed', proposedName: 'Fox large pointed', reviewGroup: 'ears', reviewOrder: inGroup('ears'),
    slot: 'ears', category: 'ears', mountPoint: 'ears', requiredRoles: ['leftEar', 'rightEar'],
    capabilities: ['earWiggle'], tags: ['fox', 'vulpine', 'pointed', 'large'], species: ['fox'],
    direction: 'Tall triangles, wider at the base and leaning outward.',
    distinct: 'Much taller and wider than the cat\'s.',
    turn: 'needs-profile'
  }),
  asset({
    id: 'ears.dog-folded', proposedName: 'Dog folded', reviewGroup: 'ears', reviewOrder: inGroup('ears'),
    slot: 'ears', category: 'ears', mountPoint: 'ears', requiredRoles: ['leftEar', 'rightEar'],
    capabilities: ['earWiggle'], tags: ['dog', 'canine', 'folded', 'floppy'], species: ['dog'],
    direction: 'Ears that fold over and hang down beside the head.',
    distinct: 'Hanging, where every other pair stands up.',
    turn: 'needs-profile', notes: 'The only pair that hangs: its wiggle should swing rather than twitch.'
  }),
  asset({
    id: 'ears.bear-round', proposedName: 'Bear round', reviewGroup: 'ears', reviewOrder: inGroup('ears'),
    slot: 'ears', category: 'ears', mountPoint: 'ears', requiredRoles: ['leftEar', 'rightEar'],
    capabilities: ['earWiggle'], tags: ['bear', 'round', 'small'], species: ['bear'],
    direction: 'Two small circles set wide on top of the skull, with an inner ear.',
    distinct: 'Round and set high, where the shipped ears.round sits at the side of the head.',
    turn: 'needs-profile', notes: 'The likeliest of the four to become a reuse of ears.round if the sheet says the side placement reads.'
  }),

  /* ── Muzzles ───────────────────────────────────────────────────────────
   * Four, one a species, all `accessory` at `nose.center`: a muzzle is artwork
   * parented to the head, and the rig that plays it is the accessory rig it
   * already has. No new semantic part, and no new control.
   *
   * The open graphical question of the whole pilot is here: the nose and the
   * mouth are semantic parts that must stay on top of — or cut through — the
   * snout. See `PILOT_OPEN_QUESTIONS`.
   */
  asset({
    id: 'accessory.muzzle-feline-short', proposedName: 'Short feline muzzle', reviewGroup: 'muzzles', reviewOrder: inGroup('muzzles'),
    slot: 'muzzle', category: 'accessory', mountPoint: 'nose.center', requiredRoles: ['element'],
    tags: ['cat', 'feline', 'short', 'broad'], species: ['cat'],
    direction: 'Short and broad, two cheek pads meeting under the nose.',
    distinct: 'Shortest and broadest of the four.',
    turn: 'needs-profile'
  }),
  asset({
    id: 'accessory.muzzle-canine-medium', proposedName: 'Medium canine muzzle', reviewGroup: 'muzzles', reviewOrder: inGroup('muzzles'),
    slot: 'muzzle', category: 'accessory', mountPoint: 'nose.center', requiredRoles: ['element'],
    tags: ['dog', 'canine', 'medium', 'rounded'], species: ['dog'],
    direction: 'Longer than the cat\'s and rounded at the end.',
    distinct: 'Longer than feline-short, blunter than canine-narrow.',
    turn: 'needs-profile'
  }),
  asset({
    id: 'accessory.muzzle-canine-narrow', proposedName: 'Narrow canine muzzle', reviewGroup: 'muzzles', reviewOrder: inGroup('muzzles'),
    slot: 'muzzle', category: 'accessory', mountPoint: 'nose.center', requiredRoles: ['element'],
    tags: ['fox', 'vulpine', 'canine', 'narrow', 'pointed'], species: ['fox'],
    direction: 'Narrow and slightly pointed.',
    distinct: 'Narrower and sharper than canine-medium.',
    turn: 'needs-profile'
  }),
  asset({
    id: 'accessory.muzzle-bear-broad', proposedName: 'Broad bear muzzle', reviewGroup: 'muzzles', reviewOrder: inGroup('muzzles'),
    slot: 'muzzle', category: 'accessory', mountPoint: 'nose.center', requiredRoles: ['element'],
    tags: ['bear', 'broad', 'round'], species: ['bear'],
    direction: 'Wide and round, with a large nose area.',
    distinct: 'Widest of the four, and the only one drawn around a large nose.',
    turn: 'needs-profile'
  }),

  /* ── Noses ─────────────────────────────────────────────────────────────
   * Two drawings. `nose.cartoon` is already a big round nose with a fill and
   * an outline, so the rounded-animal family is a reuse.
   */
  asset({
    id: 'nose.triangle-small', proposedName: 'Small triangle', reviewGroup: 'noses', reviewOrder: inGroup('noses'),
    slot: 'nose', category: 'nose', mountPoint: 'nose.center', requiredRoles: ['nose'],
    capabilities: ['noseScrunch'], tags: ['cat', 'fox', 'triangle', 'small'], species: ['cat', 'fox'],
    direction: 'A small rounded triangle, point down.',
    distinct: 'Triangular and small, where nose.broad-bear is wide and round.'
  }),
  asset({
    id: 'nose.broad-bear', proposedName: 'Broad bear nose', reviewGroup: 'noses', reviewOrder: inGroup('noses'),
    slot: 'nose', category: 'nose', mountPoint: 'nose.center', requiredRoles: ['nose'],
    capabilities: ['noseScrunch'], tags: ['bear', 'broad', 'large'], species: ['bear'],
    direction: 'A wide rounded nose covering most of the top of the muzzle.',
    distinct: 'Much wider than nose.triangle-small and than the reused nose.cartoon.'
  }),

  /* ── Mouths ────────────────────────────────────────────────────────────
   * One drawing. The animal smile — the ω under the nose — is what a human
   * mouth cannot stand in for; neutral and open-friendly are `mouth.small` and
   * `mouth.cartoon`, which already carry the controls.
   *
   * The muzzle does **not** absorb this: `mouthOpen`, `smile` and `mouthWidth`
   * stay the semantic mouth's, exactly as on a person (MASC-10A §12).
   */
  asset({
    id: 'mouth.animal-smile', proposedName: 'Animal smile', reviewGroup: 'mouths', reviewOrder: inGroup('mouths'),
    slot: 'mouth', category: 'mouth', mountPoint: 'mouth.center', requiredRoles: ['mouth'],
    capabilities: ['mouthOpen', 'smile', 'mouthWidth'], tags: ['animal', 'smile', 'omega'], species: ['cat', 'fox'],
    direction: 'The ω: two curves meeting under the nose, turning up at the ends.',
    distinct: 'The only mouth in the library drawn as two curves rather than one.',
    notes: 'Must open and smile like any mouth: the drivers are the category\'s, and no new control is added.'
  }),

  /* ── Whiskers ──────────────────────────────────────────────────────────
   * Two drawings. "None" is not an asset: it is a recipe that names none, and
   * the dog and the bear are exactly that.
   */
  asset({
    id: 'accessory.whiskers-three-straight', proposedName: 'Three straight whiskers', reviewGroup: 'whiskers', reviewOrder: inGroup('whiskers'),
    slot: 'whiskers', category: 'accessory', mountPoint: 'nose.center', requiredRoles: ['element'],
    tags: ['cat', 'feline', 'three', 'straight'], species: ['cat'],
    direction: 'Three straight whiskers a side, fanned from the cheek pad.',
    distinct: 'Three and straight, where whiskers-two-soft is two and curved.',
    turn: 'needs-profile'
  }),
  asset({
    id: 'accessory.whiskers-two-soft', proposedName: 'Two soft whiskers', reviewGroup: 'whiskers', reviewOrder: inGroup('whiskers'),
    slot: 'whiskers', category: 'accessory', mountPoint: 'nose.center', requiredRoles: ['element'],
    tags: ['fox', 'soft', 'two', 'curved'], species: ['fox'],
    direction: 'Two soft curved whiskers a side, shorter and lower.',
    distinct: 'Two and curved, where whiskers-three-straight is three and straight.',
    turn: 'needs-profile'
  })
]);
seen = {};

/**
 * What the 47 shipped drawings are worth to an animal face (MASC-10A §14).
 *
 * The point of the audit is the four `reuse` lines: four drawings nobody has to
 * make. Nothing here changes any asset's metadata — this is a reading.
 */
export const PILOT_REUSE = Object.freeze([
  Object.freeze({ id: 'eyebrows.thin', verdict: 'reuse', why: 'A thin arc above the eye reads as an animal brow unchanged. It is the soft brow family, named by three of the four recipes.' }),
  Object.freeze({ id: 'nose.cartoon', verdict: 'reuse', why: 'A big round nose with a fill and an outline: the rounded-animal nose, already drawn. The dog takes it.' }),
  Object.freeze({ id: 'mouth.small', verdict: 'reuse', why: 'A short neutral line: the animal-neutral mouth, with mouthOpen, smile and mouthWidth already on it. The bear takes it.' }),
  Object.freeze({ id: 'mouth.cartoon', verdict: 'reuse', why: 'An open mouth with teeth and a tongue: the open-friendly mouth. The dog takes it.' }),

  Object.freeze({ id: 'head.round', verdict: 'possible-reuse', why: 'If the fit sheet says animal-round does not read differently enough from it, this is the head and one drawing is saved.' }),
  Object.freeze({ id: 'head.narrow', verdict: 'possible-reuse', why: 'Same question for animal-narrow and the fox.' }),
  Object.freeze({ id: 'head.wide', verdict: 'possible-reuse', why: 'A broad skull that might carry the bear without a drawing of its own.' }),
  Object.freeze({ id: 'ears.round', verdict: 'possible-reuse', why: 'Round ears, but at the side of the skull. If a bear reads with side ears, ears.bear-round is not needed.' }),
  Object.freeze({ id: 'eyes.round-large', verdict: 'possible-reuse', why: 'Big round eyes with round pupils: close to cartoon-large. The sheet decides whether an animal needs its own.' }),
  Object.freeze({ id: 'eyes.cartoon', verdict: 'possible-reuse', why: 'Tall ovals with big pupils — another candidate for the friendly animal eye.' }),
  Object.freeze({ id: 'eyebrows.expressive', verdict: 'possible-reuse', why: 'A candidate for the fox\'s sharp brow, if angling eyebrows.thin is not enough.' }),
  Object.freeze({ id: 'mouth.simple', verdict: 'possible-reuse', why: 'One curve. It may carry the animal smile if the ω turns out not to be needed.' }),
  Object.freeze({ id: 'nose.dot', verdict: 'possible-reuse', why: 'A round dot. Too small for a muzzle but worth trying on the cat before drawing a triangle.' }),
  Object.freeze({ id: 'accessory.glasses', verdict: 'possible-reuse', why: 'Universal: an animal in glasses is a perfectly good mascot, and the drawing already exists.' }),
  Object.freeze({ id: 'accessory.square-glasses', verdict: 'possible-reuse', why: 'The same: universal eyewear, and a square frame on a fox is a joke worth having.' }),
  Object.freeze({ id: 'accessory.hat', verdict: 'possible-reuse', why: 'Sits at head.top; an animal wearing one needs the ears not to be in the way. Worth a sheet.' }),
  Object.freeze({ id: 'accessory.bow-tie', verdict: 'possible-reuse', why: 'At head.bottom, under the chin: works on any face.' }),

  Object.freeze({ id: 'eyes.round-small', verdict: 'replace', why: 'Small round eyes read as a person squinting rather than as an animal.' }),
  Object.freeze({ id: 'eyes.sleepy', verdict: 'replace', why: 'Heavy human lids: the animal expression comes from the pupil and the ear, not from the lid.' }),
  Object.freeze({ id: 'eyes.minimal', verdict: 'replace', why: 'Two dots have no pupil to make vertical, which is where a cat reads.' }),
  Object.freeze({ id: 'nose.hook', verdict: 'replace', why: 'A hooked line is a human profile nose.' }),
  Object.freeze({ id: 'nose.soft', verdict: 'replace', why: 'A curve *under* the nose: a human shorthand with nothing for a muzzle to carry.' }),
  Object.freeze({ id: 'ears.large', verdict: 'replace', why: 'Big ovals at the side of the head: human ears, and the wrong place for every species here.' }),
  Object.freeze({ id: 'ears.small', verdict: 'replace', why: 'Small tucked ovals at the side of the head: the same human placement, smaller.' }),
  Object.freeze({ id: 'mouth.wide', verdict: 'replace', why: 'A wide human grin with teeth; the animal open mouth is mouth.cartoon.' }),
  Object.freeze({ id: 'mouth.expressive', verdict: 'replace', why: 'Human lips with a defined shape; an animal mouth is a line, not a pair of lips.' }),
  Object.freeze({ id: 'head.oval', verdict: 'replace', why: 'A human oval: taller than it is wide, which no species here wants.' }),
  Object.freeze({ id: 'head.square-soft', verdict: 'replace', why: 'Reads as a machine or a heavy human jaw.' }),
  Object.freeze({ id: 'head.pear', verdict: 'replace', why: 'A narrow brow over a heavy human jaw, which reads as a person every time.' }),
  Object.freeze({ id: 'head.chin', verdict: 'replace', why: 'Wide cheeks over a flat human chin: a jaw shape no animal in the pilot has.' }),
  Object.freeze({ id: 'head.heart', verdict: 'replace', why: 'A broad brow tapering to a small human chin: the wrong taper for a snout.' }),
  Object.freeze({ id: 'eyebrows.normal', verdict: 'replace', why: 'Human weight; eyebrows.thin is the lighter one that carries over.' }),
  Object.freeze({ id: 'eyebrows.thick', verdict: 'replace', why: 'Heavy human weight over an animal eye reads as a man in a costume.' }),
  Object.freeze({ id: 'eyebrows.flat', verdict: 'replace', why: 'Flat brows read as a robot rather than an animal.' }),

  Object.freeze({ id: 'hair.short', verdict: 'not-relevant', why: 'Hair is a human slot; fur is painted into the head and the ears.' }),
  Object.freeze({ id: 'hair.spiky', verdict: 'not-relevant', why: 'A spiky human fringe has nothing to sit on once the ears are on top of the skull.' }),
  Object.freeze({ id: 'hair.curly', verdict: 'not-relevant', why: 'Curls read as a wig on an animal; fur is painted into the head and the ears.' }),
  Object.freeze({ id: 'hair.long', verdict: 'not-relevant', why: 'Long hair paints a back layer behind the face, which an animal head has no use for.' }),
  Object.freeze({ id: 'hair.balding', verdict: 'not-relevant', why: 'A receding human hairline says nothing about a species.' }),
  Object.freeze({ id: 'hair.bald', verdict: 'not-relevant', why: 'A bald cap is the absence of hair, and a muzzle face names no hair at all.' }),
  Object.freeze({ id: 'facialhair.moustache', verdict: 'not-relevant', why: 'Facial hair is a human slot; the whiskers slot is the animal answer.' }),
  Object.freeze({ id: 'facialhair.large-moustache', verdict: 'not-relevant', why: 'A big human moustache sits exactly where the muzzle goes, and is not whiskers.' }),
  Object.freeze({ id: 'facialhair.goatee', verdict: 'not-relevant', why: 'A goatee under an animal mouth reads as a costume, not as a species.' }),
  Object.freeze({ id: 'facialhair.beard', verdict: 'not-relevant', why: 'A beard covers the whole lower face, which is where the muzzle lives.' }),
  Object.freeze({ id: 'facialhair.sideburns', verdict: 'not-relevant', why: 'Sideburns mount at the human ears, which no species here has at the side of the head.' }),
  Object.freeze({ id: 'accessory.earring', verdict: 'not-relevant', why: 'Hosted on a human ear at the side of the head; the pilot\'s ears are on top of it.' }),
  Object.freeze({ id: 'accessory.earring-right', verdict: 'not-relevant', why: 'The same, on the other side: it hosts on an ear the pilot moves to the top of the skull.' })
]);

/**
 * Colours, as palettes rather than as drawings (MASC-10A §16).
 *
 * A ginger cat and a grey cat are **one drawing and two palettes**. Nothing in
 * the pilot is drawn twice for a colour, and no token is added: every one below
 * is one of the twelve the library already has.
 *
 * `hair` and `hairShadow` have nothing to paint on an animal — there is no hair
 * slot in a `muzzle` face — so they are simply unused, and the Colours row
 * shows no swatch for a token nothing is painted in. The muzzle pad and the
 * inner ear take `skinShadow`, which is what the question in
 * `PILOT_OPEN_QUESTIONS` is about.
 */
export const PILOT_PALETTES = Object.freeze({
  'cat-ginger': Object.freeze({ species: 'cat', skin: '#e8a45c', skinShadow: '#f3d7b4', outline: '#8a4f22', eyeWhite: '#ffffff', pupil: '#2f3a43', mouth: '#7a3b45', tongue: '#e08a96', teeth: '#fff8ec', accessoryPrimary: '#8a4f22', accessorySecondary: '#f3d7b4' }),
  'cat-grey': Object.freeze({ species: 'cat', skin: '#9aa3ab', skinShadow: '#d6dbdf', outline: '#4a545c', eyeWhite: '#ffffff', pupil: '#2f3a43', mouth: '#7a3b45', tongue: '#e08a96', teeth: '#fff8ec', accessoryPrimary: '#4a545c', accessorySecondary: '#d6dbdf' }),
  'dog-brown': Object.freeze({ species: 'dog', skin: '#b98150', skinShadow: '#f0dcc0', outline: '#6d4526', eyeWhite: '#ffffff', pupil: '#2f2a24', mouth: '#6d2831', tongue: '#e08a96', teeth: '#fff8ec', accessoryPrimary: '#6d4526', accessorySecondary: '#f0dcc0' }),
  'fox-ginger': Object.freeze({ species: 'fox', skin: '#d86a2c', skinShadow: '#f7e3cd', outline: '#5e2f14', eyeWhite: '#ffffff', pupil: '#2a231c', mouth: '#7a3b45', tongue: '#e08a96', teeth: '#fff8ec', accessoryPrimary: '#5e2f14', accessorySecondary: '#f7e3cd' }),
  'bear-brown': Object.freeze({ species: 'bear', skin: '#8d6243', skinShadow: '#d9b892', outline: '#4e3524', eyeWhite: '#ffffff', pupil: '#2a231c', mouth: '#6d2831', tongue: '#d9707f', teeth: '#fff8ec', accessoryPrimary: '#4e3524', accessorySecondary: '#d9b892' })
});

/**
 * The four recipes, written in the shape a real preset is written in.
 *
 * `parts` names one drawing per category, `accessories` the muzzle and the
 * whiskers — which is how the library already carries a piece a face wears
 * several of. There is no `pupils` key, because a preset may not name one:
 * the eye set brings them (see the Eyes section above, and `presetCoverage`).
 *
 * A recipe names ids from this manifest **and** ids from the shipped library,
 * side by side, which is the whole point: a cat is nine drawings, three of
 * which somebody already made.
 */
export const PILOT_PRESETS = Object.freeze([
  Object.freeze({
    id: 'cat', proposedName: 'Cat', species: 'cat', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Friendly, compact, rounded: large eyes, pointed ears, a short feline muzzle, a small triangular nose, whiskers you can see.',
    tags: Object.freeze(['cat', 'feline']),
    parts: Object.freeze({ head: 'head.animal-round', eyes: 'eyes.cartoon-large-slit', eyebrows: 'eyebrows.thin', ears: 'ears.cat-pointed', nose: 'nose.triangle-small', mouth: 'mouth.animal-smile' }),
    accessories: Object.freeze(['accessory.muzzle-feline-short', 'accessory.whiskers-three-straight']),
    palette: 'cat-ginger', alternatePalettes: Object.freeze(['cat-grey'])
  }),
  Object.freeze({
    id: 'dog', proposedName: 'Dog', species: 'dog', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Friendly, a slightly longer face, folded ears, a medium canine muzzle, a rounded nose, no whiskers.',
    tags: Object.freeze(['dog', 'canine']),
    parts: Object.freeze({ head: 'head.animal-round', eyes: 'eyes.cartoon-large', eyebrows: 'eyebrows.thin', ears: 'ears.dog-folded', nose: 'nose.cartoon', mouth: 'mouth.cartoon' }),
    accessories: Object.freeze(['accessory.muzzle-canine-medium']),
    palette: 'dog-brown', alternatePalettes: Object.freeze([])
  }),
  Object.freeze({
    id: 'fox', proposedName: 'Fox', species: 'fox', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Alert: a narrower face, large pointed ears, a narrow muzzle, a small triangular nose, a lighter expression.',
    tags: Object.freeze(['fox', 'vulpine']),
    parts: Object.freeze({ head: 'head.animal-narrow', eyes: 'eyes.alert-almond', eyebrows: 'eyebrows.animal-sharp', ears: 'ears.fox-large-pointed', nose: 'nose.triangle-small', mouth: 'mouth.animal-smile' }),
    accessories: Object.freeze(['accessory.muzzle-canine-narrow', 'accessory.whiskers-two-soft']),
    palette: 'fox-ginger', alternatePalettes: Object.freeze([])
  }),
  Object.freeze({
    id: 'bear', proposedName: 'Bear', species: 'bear', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Broad and round: small round ears, a broad muzzle, a large nose, friendly eyes, no whiskers.',
    tags: Object.freeze(['bear', 'ursine']),
    parts: Object.freeze({ head: 'head.animal-round', eyes: 'eyes.cartoon-large', eyebrows: 'eyebrows.thin', ears: 'ears.bear-round', nose: 'nose.broad-bear', mouth: 'mouth.small' }),
    accessories: Object.freeze(['accessory.muzzle-bear-broad']),
    palette: 'bear-brown', alternatePalettes: Object.freeze([])
  })
]);

/**
 * What the drawings have to settle, written down so MASC-10B does not have to
 * rediscover it (MASC-10A §19, §17, and the muzzle's own problem).
 */
export const PILOT_OPEN_QUESTIONS = Object.freeze([
  Object.freeze({
    id: 'muzzle-over-mouth', about: 'muzzles',
    question: 'A muzzle is an accessory painted over the face; the nose and the mouth are semantic parts under it. Drawn plainly, the snout hides both.',
    proposal: 'The muzzle declares its pads under `behind`, as hair.long declares hairBack, so they paint behind the features. The alternative is a snout drawn with the nose and mouth area cut out. The first muzzle sheet decides.'
  }),
  Object.freeze({
    id: 'ears-on-top', about: 'ears',
    question: 'Every shipped ear pair sits at the side of the skull at y 118. All four animal pairs sit on top of it, so their reference box centre is far above the `ears` anchor.',
    proposal: 'The offset from the anchor is what a fit keeps, so this should work; the fit matrix across Round, Narrow, Wide and Square is what proves it. If it does not, `head.top` is the anchor to try.'
  }),
  Object.freeze({
    id: 'ear-draw-order', about: 'ears',
    question: 'Shipped ears are painted behind the skull, so half of each shows. Ears on top of the head want to be in front of it, or the skull covers them.',
    proposal: 'Check on the first sheet; `behind` is the field, and it is per-asset.'
  }),
  Object.freeze({
    id: 'accessory-turn-profiles', about: 'muzzles',
    question: 'An accessory that says nothing about the 2.5D turn does not turn well. Glasses, the hat and the earrings each declare a `turn` profile; a muzzle and a pair of whiskers will need one too.',
    proposal: 'A muzzle projects forward, so a high `depth` with `narrow`, like the moustache\'s 0.88. Whiskers sweep with it. Written when the drawings exist, never before.'
  }),
  Object.freeze({
    id: 'pad-colour-token', about: 'palettes',
    question: 'The muzzle pad and the inner ear need a colour that is not the fur. `skinShadow` is the only existing token that fits, and it is also what shades the head.',
    proposal: 'Use `skinShadow` and see whether one colour for both reads. Adding a token is a change to the palette contract and is out of scope here; if the sheet proves it necessary, MASC-10B adds it with the evidence.'
  }),
  Object.freeze({
    id: 'alert-cat', about: 'eyes',
    question: 'Almond eyes with a vertical pupil — an alert cat — is the fourth combination and nobody needs it yet.',
    proposal: 'Leave it undrawn. It is one more eye set whenever a recipe asks, not a decision to take now.'
  }),
  Object.freeze({
    id: 'animal-head-necessity', about: 'heads',
    question: 'head.round and head.narrow may already carry these four species.',
    proposal: 'The heads sheet compares them side by side first. Two drawings are saved if they do.'
  })
]);

/* ── Reading the manifest ─────────────────────────────────────────────── */

const byId = new Map(PILOT_ASSETS.map((item) => [item.id, item]));

/**
 * The planned drawings, narrowed.
 * @param {{ group?, slot?, species?, status?, standalone?: boolean }} [query]
 */
export function pilotAssets({ group = null, slot = null, species = null, status = null, standalone = null } = {}) {
  return PILOT_ASSETS.filter((item) => (!group || item.reviewGroup === group)
    && (!slot || item.slot === slot)
    && (!species || item.species.includes(species))
    && (!status || item.status === status)
    && (standalone === null || (item.standalone !== false) === standalone))
    .slice().sort((a, b) => a.reviewOrder - b.reviewOrder);
}

/** One planned drawing, or null. */
export const pilotAsset = (id) => byId.get(String(id ?? '')) || null;

/** The planned drawings for one visual slot. */
export const pilotAssetsForSlot = (slot) => pilotAssets({ slot });

/** The planned drawings one species needs. */
export const pilotAssetsForSpecies = (species) => pilotAssets({ species });

/** One recipe, or null. */
export const pilotPreset = (id) => PILOT_PRESETS.find((item) => item.id === String(id ?? '')) || null;

/** What an existing drawing is worth to the pilot, or null for one nobody looked at. */
export const pilotReuse = (id) => PILOT_REUSE.find((item) => item.id === String(id ?? '')) || null;

/** Every id a recipe names, planned and shipped alike. */
export const presetAssetIds = (preset) => [...Object.values(preset?.parts || {}), ...(preset?.accessories || [])];

/**
 * What a recipe puts on a face, category by category — **including the pupils**,
 * which no preset may name and which the eye set brings.
 *
 * That resolution is the whole reason this helper exists: the pilot promises
 * every species a pupil family, and the only honest way to check the promise is
 * to read it off the eyes.
 *
 * @returns {Record<string, string|null>} category → asset id, `pupils` resolved
 */
export function presetCoverage(id) {
  const preset = pilotPreset(id);
  if (!preset) return null;
  const pupils = PILOT_ASSETS.find((item) => item.reviewGroup === 'pupils' && item.drawnBy.includes(preset.parts.eyes));
  return {
    ...preset.parts,
    // A shipped eye set draws pupils the pilot never planned, and says so
    // rather than answering null: the promise is that every species has a
    // pupil family, not that the pilot drew it.
    pupils: pupils?.id || (pilotAsset(preset.parts.eyes) ? null : `drawn by ${preset.parts.eyes}`),
    muzzle: preset.accessories.find((assetId) => pilotAsset(assetId)?.slot === 'muzzle') || null,
    whiskers: preset.accessories.find((assetId) => pilotAsset(assetId)?.slot === 'whiskers') || null
  };
}

/**
 * Two planned drawings that would be the same drawing (MASC-10A §21).
 *
 * Not deduplication and not cleverness: two entries in one slot, wanted by one
 * species, are a duplicate unless each says how it differs from the other. The
 * discipline is the `distinct` line, and this is what checks it was written.
 *
 * @returns {{ a: string, b: string, slot: string, species: string[] }[]}
 */
export function duplicateConcerns(assets = PILOT_ASSETS) {
  const out = [];
  for (const [index, a] of assets.entries()) {
    for (const b of assets.slice(index + 1)) {
      if (a.slot !== b.slot) continue;
      const shared = a.species.filter((name) => b.species.includes(name));
      if (!shared.length) continue;
      if (a.distinct && b.distinct) continue;
      out.push({ a: a.id, b: b.id, slot: a.slot, species: shared });
    }
  }
  return out;
}

/** The pilot in one line, for the report and for a test to hold it to. */
export const pilotSummary = () => ({
  drawings: pilotAssets({ standalone: true }).length,
  planned: PILOT_ASSETS.length,
  reused: [...new Set(PILOT_PRESETS.flatMap(presetAssetIds).filter((id) => !byId.has(id)))].length,
  presets: PILOT_PRESETS.length,
  groups: Object.fromEntries(PILOT_REVIEW_GROUPS.map((group) => [group, pilotAssets({ group }).length]))
});
