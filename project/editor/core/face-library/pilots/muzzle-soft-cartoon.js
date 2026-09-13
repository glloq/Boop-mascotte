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
 * Species are **not** libraries. A fox and a wolf share their eyes and their
 * brows, a cat and a fox share a nose, a dog and a wolf share a muzzle; what
 * makes each one itself is its ears, its muzzle and its palette. Forty-five
 * drawings dress six species across eight slots — forty-eight pieces if every
 * species owned its own.
 *
 * The inventory follows the **parts sheet** delivered with this brief, section
 * for section: six heads, six eye sets, five brows, eight ear pairs, six
 * muzzles, five noses, five mouths, four sets of whiskers. Each entry carries
 * the sheet's own label under `sheetLabel`, so a drawing on the planche and a
 * line here are the same thing.
 *
 * Two of the sheet's own captions settle questions the manifest had open:
 *
 * ```text
 * "6 styles d'yeux (pupilles intégrées)"        an eye set draws its own pupils
 * "6 museaux modulaires (sans nez ni bouche)"   a muzzle is a pad, features on top
 * ```
 *
 * Every id below is a *proposal*. MASC-10B draws them, runs each through
 * `npm run face:assets` (docs/FACE_ASSET_AUTHORING.md), and registers what
 * survives.
 */
import { FACE_BASE_STYLE_ID } from '../face-styles.js';

export const PILOT_ID = 'muzzle-soft-cartoon';
export const PILOT_MORPHOLOGY = 'muzzle';
export const PILOT_STYLE = FACE_BASE_STYLE_ID;

/** The art direction this manifest follows, piece for piece. */
export const PILOT_SHEET = 'Soft Cartoon — Face Parts V1';

/**
 * The species the pilot dresses. Each is a **preset inside `muzzle`**, never a
 * morphology.
 *
 * Six, not four: the sheet draws a rabbit's ears, a rodent's muzzle, a button
 * nose and a wolf's ears, which is a rabbit and a wolf fully specified. Leaving
 * them unnamed would be drawing pieces for nobody.
 */
export const PILOT_SPECIES = Object.freeze(['cat', 'dog', 'fox', 'bear', 'rabbit', 'wolf']);

/**
 * Where a planned drawing is between "somebody should draw this" and "the
 * library has it". Pilot vocabulary only: no face part carries it, and nothing
 * in the editor reads it.
 */
export const PILOT_STATUSES = Object.freeze(['needs-art', 'candidate', 'approved', 'rejected']);

/**
 * What MASC-10B drew, which is all forty-five of them, and that ship from
 * `builtin/animals/`. They are `candidate`: the drawing exists and nobody has
 * signed it off, which is precisely what `npm run face:assets` is for.
 *
 * `pupils.round` and `pupils.vertical` are on it too, and are the two entries
 * with no drawing of their own: they are what the eye sets draw *inside*
 * themselves, so they exist the moment their eye sets do. The entries are here
 * so the manifest can say which eye set draws each.
 *
 * Written out here rather than read off the library, because the manifest is a
 * document -- what was asked for, and what came back -- and a document that
 * derives its own answer from the thing it is describing cannot disagree with
 * it. A test compares the two lists, so the disagreement is caught instead.
 */
const DRAWN = new Set([
  'head.animal-round', 'head.animal-narrow', 'head.animal-wide', 'head.animal-square', 'head.animal-small', 'head.animal-chubby',
  'eyes.animal-round-large', 'eyes.animal-round-slit', 'eyes.animal-almond-alert', 'eyes.animal-sleepy', 'eyes.animal-happy', 'eyes.animal-small-cute',
  'eyebrows.animal-thin-soft', 'eyebrows.animal-firm', 'eyebrows.animal-thick', 'eyebrows.animal-friendly-raised', 'eyebrows.animal-worried',
  'ears.cat-pointed', 'ears.fox-large-pointed', 'ears.wolf-pointed', 'ears.dog-folded', 'ears.bear-round', 'ears.rabbit-long',
  'ears.small-round', 'ears.tufted',
  'accessory.muzzle-feline-short', 'accessory.muzzle-feline-rounded', 'accessory.muzzle-canine-medium',
  'accessory.muzzle-canine-narrow', 'accessory.muzzle-bear-broad', 'accessory.muzzle-rodent-small',
  'nose.triangle-small', 'nose.bear-broad', 'nose.button-tiny', 'nose.oval-soft', 'nose.animal-rounded',
  'mouth.animal-smile', 'mouth.animal-neutral', 'mouth.animal-open-friendly', 'mouth.animal-small-smile', 'mouth.animal-happy-curve',
  'accessory.whiskers-three-straight', 'accessory.whiskers-two-soft', 'accessory.whiskers-long-curved', 'accessory.whiskers-subtle-short',
  'pupils.round', 'pupils.vertical'
]);

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

/**
 * One planned drawing. Everything optional has a default, so a group's table
 * below says only what varies.
 */
const asset = (entry) => Object.freeze({
  species: Object.freeze([]), tags: Object.freeze([]), capabilities: Object.freeze([]),
  morphologies: Object.freeze([PILOT_MORPHOLOGY]), priority: 'pilot', status: 'needs-art',
  // Which drawings put this on the face, when it is not a card of its own.
  // The pupils are the only case, and the reason is below.
  drawnBy: Object.freeze([]), distinct: '', turn: 'category-default', notes: '',
  // A piece no recipe names: an expression or a species an author picks for
  // themselves. The library is a library, not four presets.
  catalogue: false, sheetLabel: '',
  ...entry,
  status: entry.status || (DRAWN.has(entry.id) ? 'candidate' : 'needs-art'),
  drawnBy: Object.freeze([...(entry.drawnBy || [])]),
  tags: Object.freeze([...(entry.tags || [])]), species: Object.freeze([...(entry.species || [])]),
  capabilities: Object.freeze([...(entry.capabilities || [])]), requiredRoles: Object.freeze([...(entry.requiredRoles || [])]),
  morphologies: Object.freeze([...(entry.morphologies || [PILOT_MORPHOLOGY])])
});

const ORDER = Object.fromEntries(PILOT_REVIEW_GROUPS.map((group, index) => [group, (index + 1) * 10]));
let seen = {};
const inGroup = (group) => { seen[group] = (seen[group] || 0) + 1; return ORDER[group] + seen[group]; };

/** A section of the sheet: everything its pieces share, filled in once. */
const section = (reviewGroup, { prefix, ...shared }) => (slug, sheetLabel, proposedName, direction, species, tags, distinct, extra = {}) =>
  asset({ ...shared, id: `${prefix}.${slug}`, reviewGroup, reviewOrder: inGroup(reviewGroup), sheetLabel, proposedName, direction, species, tags, distinct, ...extra });

const head = section('heads', { prefix: 'head', slot: 'head', category: 'head', mountPoint: 'head.center', requiredRoles: ['head'], capabilities: ['headX', 'headY', 'headTilt'] });
const eyes = section('eyes', { prefix: 'eyes', slot: 'eyes', category: 'eyes', mountPoint: 'eyes', requiredRoles: ['leftEye', 'rightEye'], capabilities: ['eyeOpen'] });
const pupils = section('pupils', { prefix: 'pupils', slot: 'pupils', category: 'pupils', mountPoint: 'eyes', requiredRoles: ['leftPupil', 'rightPupil'], capabilities: ['lookX', 'lookY', 'pupilScale'] });
const brow = section('brows', { prefix: 'eyebrows', slot: 'eyebrows', category: 'eyebrows', mountPoint: 'brows', requiredRoles: ['leftBrow', 'rightBrow'], capabilities: ['browRaise', 'browTilt'] });
const ear = section('ears', { prefix: 'ears', slot: 'ears', category: 'ears', mountPoint: 'ears', requiredRoles: ['leftEar', 'rightEar'], capabilities: ['earWiggle'], turn: 'needs-profile' });
const muzzle = section('muzzles', { prefix: 'accessory', slot: 'muzzle', category: 'accessory', mountPoint: 'nose.center', requiredRoles: ['element'], turn: 'needs-profile' });
const nose = section('noses', { prefix: 'nose', slot: 'nose', category: 'nose', mountPoint: 'nose.center', requiredRoles: ['nose'], capabilities: ['noseScrunch'] });
const mouth = section('mouths', { prefix: 'mouth', slot: 'mouth', category: 'mouth', mountPoint: 'mouth.center', requiredRoles: ['mouth'], capabilities: ['mouthOpen', 'smile', 'mouthWidth'] });
const whiskers = section('whiskers', { prefix: 'accessory', slot: 'whiskers', category: 'accessory', mountPoint: 'nose.center', requiredRoles: ['element'], turn: 'needs-profile' });

/**
 * The drawings the pilot needs, section by section, in the order the sheet
 * lays them out.
 *
 * Forty-five drawings, and the sharing is the point: `eyes.animal-almond-alert`
 * dresses the fox *and* the wolf, `nose.triangle-small` the cat *and* the fox,
 * `accessory.muzzle-canine-medium` the dog *and* the wolf. Six species over
 * eight slots would be forty-eight drawings if each owned its own; thirty-eight
 * of these are claimed by a recipe and eight of those are shared, and the seven
 * left over are the catalogue — an author's own choice of expression.
 */
export const PILOT_ASSETS = Object.freeze([
  /* ── 1 · Fonds de tête ─────────────────────────────────────────────────
   * "6 formes de base sans oreilles, museau, nez ni bouche": a head in this
   * library is a bare fur silhouette with a tufted edge and nothing on it.
   * Every feature is a separate piece, which is exactly the shape the rest of
   * the face library already has.
   */
  head('animal-round', 'Ronde', 'Animal round', 'A round fur silhouette with a soft tufted edge. No ears, no muzzle, no features.', ['cat'], ['animal', 'round', 'soft'], 'The roundest: as wide as it is tall.'),
  head('animal-narrow', 'Étroite', 'Animal narrow', 'Narrower and a little taller, the same tufted edge.', ['fox'], ['animal', 'narrow', 'sharp'], 'Narrower below the eyes than every other.'),
  head('animal-wide', 'Large', 'Animal wide', 'Broad and heavy, wider than it is tall.', ['bear'], ['animal', 'wide', 'heavy'], 'The widest, and the only one broader than tall.'),
  head('animal-square', 'Carrée', 'Animal square', 'A squared skull with soft corners and a spiked crown.', ['wolf'], ['animal', 'square', 'angular'], 'The only squared silhouette; the crown is spiked rather than round.'),
  head('animal-small', 'Petite', 'Animal small', 'Small and neat, with a light tufted edge.', ['rabbit'], ['animal', 'small', 'neat'], 'The smallest, and the plainest edge.'),
  head('animal-chubby', 'Joufflue', 'Animal chubby', 'Full cheeks, widest at the jaw.', ['dog'], ['animal', 'chubby', 'friendly'], 'The only one that widens towards the jaw rather than the brow.'),

  /* ── 2 · Yeux ──────────────────────────────────────────────────────────
   * "6 styles d'yeux (pupilles intégrées)" — the sheet says out loud what the
   * library already does: an eye set draws its own pupils and lids. There is
   * no standalone pupils card, and no preset may name one.
   */
  eyes('animal-round-large', 'Grands ronds', 'Big round', 'Big round eyes, round pupils, a glint high on each.', ['dog', 'rabbit'], ['animal', 'large', 'round', 'friendly'], 'Round pupils, where animal-round-slit has vertical ones.',
    { notes: 'Composite: draws the gaze (leftPupil, rightPupil) and the eyelids under `parts`, as every shipped eye set does.' }),
  eyes('animal-round-slit', 'Grands ronds pupilles fendues', 'Big round, slit', 'The same big round eye with a tall vertical slit pupil.', ['cat'], ['cat', 'feline', 'large', 'slit'], 'Vertical pupils; the socket and the lids are the big round eye\'s.'),
  eyes('animal-almond-alert', 'En amande alerte', 'Alert almond', 'Almond eyes tilted up at the outer corner: awake rather than sweet.', ['fox', 'wolf'], ['animal', 'almond', 'alert'], 'Almond and tilted, where the round family is round.'),
  eyes('animal-sleepy', 'Endormis', 'Sleepy', 'Heavy lids half over the eye, a narrow pupil beneath.', [], ['animal', 'sleepy', 'heavy'], 'Lids drawn low at rest.', { catalogue: true, notes: 'An expression, not a species: any of the six can wear it.' }),
  eyes('animal-happy', 'Joyeux', 'Happy', 'Two closed upward arcs: an eye that is already smiling.', [], ['animal', 'happy', 'closed'], 'The only pair drawn shut.',
    { catalogue: true, notes: 'Drawn shut, so it has no pupil to move and nothing left for eyeOpen to close. See the open question.' }),
  eyes('animal-small-cute', 'Petits mignons', 'Small and cute', 'Small round eyes set wide, with a large pupil each.', ['bear'], ['animal', 'small', 'cute'], 'Smallest of the six, and the widest set.'),

  /* ── Pupils, inside the eyes ───────────────────────────────────────────
   * Two families and no drawings of their own. Listed so the review has a
   * Pupils page — the pupil is where a cat stops being a dog — and so a recipe
   * can be checked for one.
   */
  pupils('round', '(pupilles intégrées)', 'Round pupils', 'A plain round pupil with a glint, as the shipped eyes have.', ['dog', 'fox', 'bear', 'wolf', 'rabbit'], ['animal', 'round'], 'Round, where pupils.vertical is a slit.',
    { drawnBy: ['eyes.animal-round-large', 'eyes.animal-almond-alert', 'eyes.animal-sleepy', 'eyes.animal-small-cute'], standalone: false, notes: 'Reviewed inside the eye sets that draw it: it has no card, and no preset names it.' }),
  pupils('vertical', '(pupilles intégrées)', 'Vertical pupils', 'A tall slit pupil, narrow at rest.', ['cat'], ['cat', 'feline', 'slit', 'vertical'], 'A slit, where pupils.round is round.',
    { drawnBy: ['eyes.animal-round-slit'], standalone: false, notes: 'Must keep the gaze working: lookX, lookY and pupilScale drive it exactly as they drive a round pupil.' }),

  /* ── 3 · Sourcils ──────────────────────────────────────────────────────
   * Five, and they carry more of the expression than anything but the ears.
   */
  brow('animal-thin-soft', 'Fins doux', 'Thin and soft', 'Thin soft arcs, set high.', ['cat', 'rabbit'], ['animal', 'thin', 'soft'], 'The lightest weight of the five.'),
  brow('animal-firm', 'Affirmés', 'Firm', 'Straighter and angled in towards the nose.', ['fox', 'wolf'], ['animal', 'firm', 'angled'], 'Angled in, where thin-soft arcs up.'),
  brow('animal-thick', 'Épais', 'Thick', 'Heavy and blunt.', ['bear'], ['animal', 'thick', 'heavy'], 'The heaviest weight of the five.'),
  brow('animal-friendly-raised', 'Relevés amicaux', 'Friendly raised', 'Raised at the outer end: open and friendly.', ['dog'], ['animal', 'raised', 'friendly'], 'The only pair raised at the outer end rather than the inner.'),
  brow('animal-worried', 'Inquiets courbés', 'Worried', 'Curved and tipped in at the inner end: worried.', [], ['animal', 'worried', 'curved'], 'Tipped in at the inner end.', { catalogue: true, notes: 'An expression, not a species.' }),

  /* ── 4 · Oreilles ──────────────────────────────────────────────────────
   * Eight pairs, and the first thing anybody reads. All of them sit **on top
   * of the skull**, where the three shipped pairs sit at its sides: that is
   * the pilot's one geometric departure, and the fit matrix has to bless it.
   */
  ear('cat-pointed', 'Chat pointues', 'Cat pointed', 'Two upright triangles with a pink inner ear.', ['cat'], ['cat', 'feline', 'pointed'], 'Upright and small, where the fox\'s are large and swept.'),
  ear('fox-large-pointed', 'Renard grandes pointues', 'Fox large pointed', 'Tall triangles, wide at the base, leaning outward, dark at the tip.', ['fox'], ['fox', 'vulpine', 'pointed', 'large'], 'Much taller and wider than the cat\'s.'),
  ear('dog-folded', 'Chien tombantes', 'Dog folded', 'Ears that fold over and hang down beside the head.', ['dog'], ['dog', 'canine', 'folded', 'floppy'], 'Hanging, where every other pair stands up.',
    { notes: 'The only pair that hangs: its wiggle should swing rather than twitch.' }),
  ear('bear-round', 'Ours rondes', 'Bear round', 'Two small circles set wide on top of the skull, with an inner ear.', ['bear'], ['bear', 'round', 'small'], 'Round and set wide, where small-round sits closer in.'),
  ear('rabbit-long', 'Lapin grandes', 'Rabbit long', 'Two long upright ears with a pale inner ear running most of their length.', ['rabbit'], ['rabbit', 'long', 'upright'], 'Far the tallest pair, and the only ones longer than the head is high.'),
  ear('wolf-pointed', 'Loup pointues', 'Wolf pointed', 'Broad-based triangles, more upright than the fox\'s and grey inside.', ['wolf'], ['wolf', 'canine', 'pointed'], 'Broader at the base and more upright than the fox\'s.'),
  ear('small-round', 'Petites rondes', 'Small round', 'Two small plain rounds, no inner ear.', [], ['animal', 'small', 'round', 'plain'], 'Plain: the only pair with no inner ear drawn.', { catalogue: true, notes: 'The neutral pair, for a creature that is not one of the six.' }),
  ear('tufted', 'Avec touffes', 'Tufted', 'Pointed ears with a tuft of fur breaking the tip.', [], ['animal', 'tufted', 'pointed', 'lynx'], 'The only pair with a tuft.', { catalogue: true, notes: 'A lynx, a squirrel, a caracal: a species the pilot does not name.' }),

  /* ── 5 · Museaux ───────────────────────────────────────────────────────
   * "6 museaux modulaires (sans nez ni bouche)" — and that line settles the
   * biggest question the pilot had. A muzzle is a **pad**, drawn with the nose
   * and the mouth left out, so the semantic nose and the semantic mouth sit on
   * top of it and keep every control they have. What is left is the draw
   * order, which `behind` answers.
   */
  muzzle('muzzle-feline-short', 'Félin court', 'Short feline muzzle', 'Short and broad, two cheek pads meeting under an open nose area.', ['cat'], ['cat', 'feline', 'short', 'broad'], 'Shortest and broadest of the six.'),
  muzzle('muzzle-feline-rounded', 'Félin arrondi', 'Rounded feline muzzle', 'The same pads, rounder and fuller.', [], ['cat', 'feline', 'rounded'], 'Rounder than feline-short, and slightly deeper.', { catalogue: true, notes: 'A second cat, or a fuller-faced one: an author\'s choice.' }),
  muzzle('muzzle-canine-medium', 'Canin moyen', 'Medium canine muzzle', 'Longer than the cat\'s and rounded at the end.', ['dog', 'wolf'], ['dog', 'canine', 'medium', 'rounded'], 'Longer than feline-short, blunter than canine-narrow.'),
  muzzle('muzzle-canine-narrow', 'Canin étroit', 'Narrow canine muzzle', 'Narrow and slightly pointed.', ['fox'], ['fox', 'vulpine', 'canine', 'narrow', 'pointed'], 'Narrower and sharper than canine-medium.'),
  muzzle('muzzle-bear-broad', 'Ours large', 'Broad bear muzzle', 'Wide and round, with a large open nose area.', ['bear'], ['bear', 'broad', 'round'], 'Widest of the six, and drawn around the largest nose.'),
  muzzle('muzzle-rodent-small', 'Rongeur petit', 'Small rodent muzzle', 'Small, high and soft, with a shallow pad each side.', ['rabbit'], ['rabbit', 'rodent', 'small'], 'The smallest, and the highest on the face.'),

  /* ── 6 · Nez ───────────────────────────────────────────────────────────
   * Five, and every one of them sits *on* the muzzle rather than in it.
   */
  nose('triangle-small', 'Petit triangle', 'Small triangle', 'A small rounded triangle, point down.', ['cat', 'fox'], ['cat', 'fox', 'triangle', 'small'], 'Triangular and small.'),
  nose('animal-rounded', 'Arrondi animal', 'Rounded animal', 'A rounded triangle, fuller at the top.', ['dog'], ['dog', 'rounded', 'animal'], 'Rounder at the top than triangle-small, smaller than bear-broad.'),
  nose('bear-broad', 'Large ours', 'Broad bear', 'A wide nose covering most of the top of the muzzle.', ['bear'], ['bear', 'broad', 'large'], 'Much the widest of the five.'),
  nose('button-tiny', 'Minuscule bouton', 'Tiny button', 'A tiny pink button.', ['rabbit'], ['rabbit', 'button', 'tiny', 'pink'], 'The smallest, and the only one drawn pink rather than dark.'),
  nose('oval-soft', 'Ovale doux', 'Soft oval', 'A soft dark oval, wider than tall.', ['wolf'], ['wolf', 'oval', 'soft'], 'Oval rather than triangular.'),

  /* ── 7 · Bouches ───────────────────────────────────────────────────────
   * "5 styles de bouches (pièces seules)": the mouth is its own piece, and it
   * keeps every control it has. The muzzle does not absorb it.
   */
  mouth('animal-smile', 'Sourire animal', 'Animal smile', 'The ω: two curves meeting under the nose, turning up at the ends.', ['cat'], ['animal', 'smile', 'omega'], 'The only mouth drawn as two curves rather than one.'),
  mouth('animal-neutral', 'Neutre', 'Neutral', 'A short line down from the nose and a small curve each side.', ['bear', 'wolf'], ['animal', 'neutral', 'plain'], 'The flattest of the five.'),
  mouth('animal-open-friendly', 'Ouverte amicale', 'Open and friendly', 'An open mouth with a tongue showing.', ['dog'], ['animal', 'open', 'friendly', 'tongue'], 'The only one drawn open.',
    { capabilities: ['mouthOpen', 'smile', 'mouthWidth', 'tongue'], notes: 'Names a tongue role, so it claims the tongue control as mouth.cartoon does.' }),
  mouth('animal-small-smile', 'Petit sourire', 'Small smile', 'One short curve turning up at the ends.', ['fox', 'rabbit'], ['animal', 'small', 'smile'], 'Shorter and shallower than happy-curve.'),
  mouth('animal-happy-curve', 'Joyeuse courbée', 'Happy curve', 'One wide curve across the lower face.', [], ['animal', 'happy', 'wide'], 'The widest single curve.', { catalogue: true, notes: 'An expression, not a species.' }),

  /* ── 8 · Moustaches ────────────────────────────────────────────────────
   * Four. "None" is not a fifth: it is a recipe that names none, and the dog
   * and the bear are exactly that.
   */
  whiskers('whiskers-three-straight', 'Trois droites', 'Three straight', 'Three straight whiskers a side, fanned from the cheek pad.', ['cat'], ['cat', 'feline', 'three', 'straight'], 'Three and straight.'),
  whiskers('whiskers-two-soft', 'Deux douces', 'Two soft', 'Two soft curved whiskers a side, shorter and lower.', ['fox'], ['fox', 'soft', 'two', 'curved'], 'Two and gently curved.'),
  whiskers('whiskers-long-curved', 'Longues courbées', 'Long curved', 'Three long whiskers a side, sweeping well past the cheek.', ['wolf'], ['wolf', 'long', 'curved'], 'The longest reach of the four.'),
  whiskers('whiskers-subtle-short', 'Subtiles courtes', 'Subtle short', 'Two short fine whiskers a side, barely past the muzzle.', ['rabbit'], ['rabbit', 'subtle', 'short'], 'The shortest and lightest.')
]);
seen = {};

/**
 * What the 47 shipped drawings are worth to an animal face (MASC-10A §14).
 *
 * The audit was made before the parts sheet arrived, when four shipped drawings
 * were going to stand in for an animal brow, an animal nose and two animal
 * mouths. **The sheet draws its own**, so those four moved back to
 * `possible-reuse`: they are what to fall back on if a planned drawing is cut,
 * and nothing is drawn twice either way.
 *
 * What survives as real value is the other direction — which shipped pieces an
 * animal face may still *wear*. Glasses, a hat and a bow tie are universal, and
 * a fox in square glasses is a perfectly good mascot.
 *
 * Nothing here changes any asset's metadata: this is a reading.
 */
export const PILOT_REUSE = Object.freeze([
  Object.freeze({ id: 'eyebrows.thin', verdict: 'possible-reuse', why: 'A thin arc above the eye reads as an animal brow unchanged. The sheet draws its own five, so this is the fallback if one of them is cut.' }),
  Object.freeze({ id: 'nose.cartoon', verdict: 'possible-reuse', why: 'A big round nose with a fill and an outline, close to the Arrondi animal on the sheet. The fallback if that one is cut.' }),
  Object.freeze({ id: 'mouth.small', verdict: 'possible-reuse', why: 'A short neutral line, close to the Neutre on the sheet. The fallback if that one is cut.' }),
  Object.freeze({ id: 'mouth.cartoon', verdict: 'possible-reuse', why: 'An open mouth with teeth and a tongue, close to the Ouverte amicale on the sheet, and the precedent for claiming the tongue control.' }),

  Object.freeze({ id: 'head.round', verdict: 'possible-reuse', why: 'If the fit sheet says animal-round does not read differently enough from it, this is the head and one drawing is saved.' }),
  Object.freeze({ id: 'head.narrow', verdict: 'possible-reuse', why: 'Same question for animal-narrow and the fox.' }),
  Object.freeze({ id: 'head.wide', verdict: 'possible-reuse', why: 'A broad skull that might carry the bear without a drawing of its own.' }),
  Object.freeze({ id: 'ears.round', verdict: 'possible-reuse', why: 'Round ears, but at the side of the skull. If a bear reads with side ears, ears.bear-round is not needed.' }),
  Object.freeze({ id: 'eyes.round-large', verdict: 'possible-reuse', why: 'Big round eyes with round pupils: close to the sheet\'s Grands ronds. The sheet decides whether an animal needs its own.' }),
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
  'cat-ginger': Object.freeze({ species: 'cat', skin: '#e8a45c', skinShadow: '#f7e3c8', outline: '#8a4f22', eyeWhite: '#ffffff', pupil: '#2f3a43', mouth: '#7a3b45', tongue: '#e08a96', teeth: '#fff8ec', accessoryPrimary: '#8a4f22', accessorySecondary: '#f7e3c8' }),
  'cat-grey': Object.freeze({ species: 'cat', skin: '#9aa3ab', skinShadow: '#e2e6e9', outline: '#4a545c', eyeWhite: '#ffffff', pupil: '#2f3a43', mouth: '#7a3b45', tongue: '#e08a96', teeth: '#fff8ec', accessoryPrimary: '#4a545c', accessorySecondary: '#e2e6e9' }),
  'dog-tan': Object.freeze({ species: 'dog', skin: '#d3a878', skinShadow: '#f4e4cd', outline: '#7a5330', eyeWhite: '#ffffff', pupil: '#3a2f26', mouth: '#6d2831', tongue: '#e08a96', teeth: '#fff8ec', accessoryPrimary: '#7a5330', accessorySecondary: '#f4e4cd' }),
  'fox-orange': Object.freeze({ species: 'fox', skin: '#e9a25a', skinShadow: '#fbeedd', outline: '#8a4a1c', eyeWhite: '#ffffff', pupil: '#2a231c', mouth: '#7a3b45', tongue: '#e08a96', teeth: '#fff8ec', accessoryPrimary: '#8a4a1c', accessorySecondary: '#fbeedd' }),
  'bear-brown': Object.freeze({ species: 'bear', skin: '#a97d55', skinShadow: '#e2c9a8', outline: '#5c3f28', eyeWhite: '#ffffff', pupil: '#2a231c', mouth: '#6d2831', tongue: '#d9707f', teeth: '#fff8ec', accessoryPrimary: '#5c3f28', accessorySecondary: '#e2c9a8' }),
  'rabbit-cream': Object.freeze({ species: 'rabbit', skin: '#f3e3cd', skinShadow: '#fdf6ec', outline: '#a3866a', eyeWhite: '#ffffff', pupil: '#3a2f26', mouth: '#b46b74', tongue: '#e08a96', teeth: '#fff8ec', accessoryPrimary: '#a3866a', accessorySecondary: '#f7c9cd' }),
  'wolf-grey': Object.freeze({ species: 'wolf', skin: '#a9a6a0', skinShadow: '#e6e4e0', outline: '#4f4c48', eyeWhite: '#ffffff', pupil: '#2a2724', mouth: '#6d2831', tongue: '#d9707f', teeth: '#fff8ec', accessoryPrimary: '#4f4c48', accessorySecondary: '#e6e4e0' })
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
    direction: 'Friendly, compact, rounded: big eyes with a slit pupil, pointed ears, a short feline muzzle, a small triangular nose, whiskers you can see.',
    tags: Object.freeze(['cat', 'feline']),
    parts: Object.freeze({ head: 'head.animal-round', eyes: 'eyes.animal-round-slit', eyebrows: 'eyebrows.animal-thin-soft', ears: 'ears.cat-pointed', nose: 'nose.triangle-small', mouth: 'mouth.animal-smile' }),
    accessories: Object.freeze(['accessory.muzzle-feline-short', 'accessory.whiskers-three-straight']),
    palette: 'cat-ginger', alternatePalettes: Object.freeze(['cat-grey'])
  }),
  Object.freeze({
    id: 'dog', proposedName: 'Dog', species: 'dog', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Friendly and full-cheeked: big round eyes, brows raised at the outer end, folded ears, a medium canine muzzle, a rounded nose, an open mouth, no whiskers.',
    tags: Object.freeze(['dog', 'canine']),
    parts: Object.freeze({ head: 'head.animal-chubby', eyes: 'eyes.animal-round-large', eyebrows: 'eyebrows.animal-friendly-raised', ears: 'ears.dog-folded', nose: 'nose.animal-rounded', mouth: 'mouth.animal-open-friendly' }),
    accessories: Object.freeze(['accessory.muzzle-canine-medium']),
    palette: 'dog-tan', alternatePalettes: Object.freeze([])
  }),
  Object.freeze({
    id: 'fox', proposedName: 'Fox', species: 'fox', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Alert: a narrow face, almond eyes, firm brows, large pointed ears, a narrow muzzle, a small triangular nose, a light smile.',
    tags: Object.freeze(['fox', 'vulpine']),
    parts: Object.freeze({ head: 'head.animal-narrow', eyes: 'eyes.animal-almond-alert', eyebrows: 'eyebrows.animal-firm', ears: 'ears.fox-large-pointed', nose: 'nose.triangle-small', mouth: 'mouth.animal-small-smile' }),
    accessories: Object.freeze(['accessory.muzzle-canine-narrow', 'accessory.whiskers-two-soft']),
    palette: 'fox-orange', alternatePalettes: Object.freeze([])
  }),
  Object.freeze({
    id: 'bear', proposedName: 'Bear', species: 'bear', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Broad and heavy: small wide-set eyes, thick brows, small round ears, a broad muzzle, a large nose, a plain mouth, no whiskers.',
    tags: Object.freeze(['bear', 'ursine']),
    parts: Object.freeze({ head: 'head.animal-wide', eyes: 'eyes.animal-small-cute', eyebrows: 'eyebrows.animal-thick', ears: 'ears.bear-round', nose: 'nose.bear-broad', mouth: 'mouth.animal-neutral' }),
    accessories: Object.freeze(['accessory.muzzle-bear-broad']),
    palette: 'bear-brown', alternatePalettes: Object.freeze([])
  }),
  Object.freeze({
    id: 'rabbit', proposedName: 'Rabbit', species: 'rabbit', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Small and soft: a neat head under long upright ears, big round eyes, thin brows, a small rodent muzzle, a tiny pink nose, fine short whiskers.',
    tags: Object.freeze(['rabbit', 'lagomorph']),
    parts: Object.freeze({ head: 'head.animal-small', eyes: 'eyes.animal-round-large', eyebrows: 'eyebrows.animal-thin-soft', ears: 'ears.rabbit-long', nose: 'nose.button-tiny', mouth: 'mouth.animal-small-smile' }),
    accessories: Object.freeze(['accessory.muzzle-rodent-small', 'accessory.whiskers-subtle-short']),
    palette: 'rabbit-cream', alternatePalettes: Object.freeze([])
  }),
  Object.freeze({
    id: 'wolf', proposedName: 'Wolf', species: 'wolf', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Squared and watchful: almond eyes, firm brows, upright ears, a medium canine muzzle, a soft oval nose, a plain mouth, long whiskers.',
    tags: Object.freeze(['wolf', 'canine', 'lupine']),
    parts: Object.freeze({ head: 'head.animal-square', eyes: 'eyes.animal-almond-alert', eyebrows: 'eyebrows.animal-firm', ears: 'ears.wolf-pointed', nose: 'nose.oval-soft', mouth: 'mouth.animal-neutral' }),
    accessories: Object.freeze(['accessory.muzzle-canine-medium', 'accessory.whiskers-long-curved']),
    palette: 'wolf-grey', alternatePalettes: Object.freeze([])
  })
]);

/**
 * What the drawings have to settle, written down so MASC-10B does not have to
 * rediscover it (MASC-10A §19, §17, and the muzzle's own problem).
 */
export const PILOT_OPEN_QUESTIONS = Object.freeze([
  Object.freeze({
    id: 'muzzle-draw-order', about: 'muzzles',
    question: 'The sheet settles half of the muzzle problem — "6 museaux modulaires (sans nez ni bouche)", so a muzzle is a pad drawn with the nose and mouth area left open and the semantic nose and mouth sit on top of it. What is left is the order: an accessory with nothing before it is installed last in the group, so a muzzle would still paint over both.',
    proposal: 'The muzzle declares its pads under `behind`, as hair.long declares hairBack, which puts them at the front of the group and therefore under the features. One line on each of the six drawings, and the first muzzle sheet proves it.'
  }),
  Object.freeze({
    id: 'closed-eyes-have-no-pupil', about: 'eyes',
    question: 'Joyeux is drawn shut: two upward arcs, no pupil. The gaze part requires leftPupil and rightPupil, and eyeOpen closes an eye that is already closed.',
    proposal: 'Either it names no `parts.gaze` at all — a face wearing it simply has no gaze, and lookX/lookY move nothing — or it draws a pupil hidden behind the arc. The first is honest and the second keeps a face switchable back to an open eye without losing its gaze rig. Decide on the eyes sheet, not here.'
  }),
  Object.freeze({
    id: 'ears-on-top', about: 'ears',
    question: 'Every shipped ear pair sits at the side of the skull at y 118. All eight on the sheet sit on top of it, so their reference box centre is far above the `ears` anchor.',
    proposal: 'The offset from the anchor is what a fit keeps, so this should work; the fit matrix across Round, Narrow, Wide and Square is what proves it. If it does not, `head.top` is the anchor to try.'
  }),
  Object.freeze({
    id: 'rabbit-ears-height', about: 'ears',
    question: 'Lapin grandes are taller than the head is high. A reference box that tall makes its centre sit well above the skull, and the artboard has 60 units of headroom above y 0 — a hat needs 42 of them.',
    proposal: 'Check the box against the artboard on the ears sheet before drawing the other seven. If the ears do not fit the frame, the pair is drawn shorter rather than the frame being changed.'
  }),
  Object.freeze({
    id: 'ear-draw-order', about: 'ears',
    question: 'Shipped ears are painted behind the skull, so half of each shows. Ears on top of the head want to be in front of it, or the skull covers them — except the folded dog pair, which reads better tucked behind.',
    proposal: 'Per-asset, and `behind` is the field. The sheet shows inner ears painted, so the pair is in front for seven of the eight; try the dog both ways.'
  }),
  Object.freeze({
    id: 'accessory-turn-profiles', about: 'muzzles',
    question: 'An accessory that says nothing about the 2.5D turn does not turn well. Glasses, the hat and the earrings each declare a `turn` profile; the six muzzles and the four sets of whiskers will need one too, and so will the ears.',
    proposal: 'A muzzle projects forward, so a high `depth` with `narrow`, like the moustache\'s 0.88. Whiskers sweep with it. Written when the drawings exist, never before.'
  }),
  Object.freeze({
    id: 'pad-colour-token', about: 'palettes',
    question: 'The muzzle pad and the inner ear need a colour that is not the fur. The sheet paints both a pale cream against the coat, and `skinShadow` is the only existing token that fits — which is also what shades the head.',
    proposal: 'Use `skinShadow` and see whether one colour reads for both. Adding a token changes the palette contract and is out of scope here; if the sheet proves it necessary, MASC-10B adds it with the evidence. The rabbit\'s pink nose is the other case: `accessorySecondary` can carry it.'
  }),
  Object.freeze({
    id: 'head-fur-edge', about: 'heads',
    question: 'The six heads are drawn with a tufted fur edge rather than a smooth outline. The head is what the 2.5D turn measures the face\'s scale from, and what a clip is cut from.',
    proposal: 'Check on the heads sheet that a tufted silhouette still measures a sensible reference box, and that the eye-socket clips a library eye set brings still sit inside it.'
  }),
  Object.freeze({
    id: 'catalogue-pieces', about: 'eyes',
    question: 'Seven of the forty-five are named by no recipe: two eye expressions, a worried brow, two ear pairs, a second feline muzzle and a wide happy mouth.',
    proposal: 'They stay. A parts library exists to be combined, and the sheet says so in its own header — these are the pieces an author reaches for. They are marked `catalogue` so nobody reads them as an oversight.'
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

/** The pieces no recipe names: an author's own choice of expression or species. */
export const catalogueAssets = () => PILOT_ASSETS.filter((item) => item.catalogue);

/** The pilot in one line, for the report and for a test to hold it to. */
export const pilotSummary = () => ({
  drawings: pilotAssets({ standalone: true }).length,
  planned: PILOT_ASSETS.length,
  claimed: pilotAssets({ standalone: true }).filter((item) => !item.catalogue).length,
  catalogue: catalogueAssets().length,
  reused: [...new Set(PILOT_PRESETS.flatMap(presetAssetIds).filter((id) => !byId.has(id)))].length,
  drawn: pilotAssets({ status: 'candidate' }).length,
  presets: PILOT_PRESETS.length,
  groups: Object.fromEntries(PILOT_REVIEW_GROUPS.map((group) => [group, pilotAssets({ group }).length]))
});
