/**
 * The brief for the first bird faces (MASC-12A; docs/BEAK_SOFT_CARTOON_PILOT.md).
 *
 * ```text
 * morphology   beak
 * style        soft-cartoon — the style the library is drawn in
 * species      Hibou · Canard · Perroquet · Corbeau · Oiseau mignon · Oiseau fin
 * ```
 *
 * **Nothing here is a face part, and nothing here is registered.** A data-only
 * cahier des charges, the third of its kind after the animals and the robots.
 *
 * The planche is the most *regular* of the three delivered so far, and that
 * shows in how little this file has to argue about:
 *
 * ```text
 * 1  Fonds de tête          6   → head
 * 2  Yeux                   6   → eyes      "pupilles intégrées", again
 * 3  Formes d'yeux/sourcils 5   → eyebrows  "à superposer"
 * 4  Becs                   6   → beak      ← the slot that makes a bird
 * 5  Crêtes / plumes        6   → crest     ← and the other one
 * 6  Accessoires            4   → accessory two of them already drawn
 * ```
 *
 * Six rows, six slots, and **every one of them is already in the `beak`
 * morphology's own list** — `head, eyes, pupils, eyebrows, beak, crest,
 * accessory`. Where the robot pack needed two slots added to `MORPHOLOGY_TABLE`
 * before a line could be drawn, this one needs nothing at all: MASC-01 guessed
 * a bird correctly, down to leaving out the nose, the mouth, the ears and the
 * hair. A beak *is* the mouth (it installs as one, and it opens); a crest is
 * what a bird has instead of hair.
 *
 * ## Thirty drawings, not thirty-three
 *
 * The planche draws thirty-three pieces and three of them already exist. The
 * accessories row is captioned "4 accessoires simples et compatibles", and
 * compatible is exactly what the library's accessories are: `accessory.glasses`
 * *is* Lunettes rondes and `accessory.bow-tie` *is* Nœud papillon, universal
 * drawings that a bird wears as readily as a person. Only the monocle has to be
 * made. The small hat is the one judgement call, and it is an open question
 * below rather than a drawing here.
 *
 * Unlike the robot planche, no row here is a colour run: the six heads are six
 * silhouettes, the six beaks six shapes. Thirty drawings is thirty drawings.
 *
 * Every id below is a proposal. MASC-12B draws them, runs each through
 * `npm run face:assets` (docs/FACE_ASSET_AUTHORING.md), and registers what
 * survives.
 */
import { FACE_BASE_STYLE_ID } from '../face-styles.js';

export const PILOT_ID = 'beak-soft-cartoon';
export const PILOT_MORPHOLOGY = 'beak';
export const PILOT_STYLE = FACE_BASE_STYLE_ID;

/** The art direction this manifest follows, row for row. */
export const PILOT_SHEET = 'Bibliothèque modulaire Boop — Oiseaux / Beak (BIRD-10A)';

/**
 * The six birds the planche dresses, named by its own head captions. Each is a
 * **preset inside `beak`**, never a morphology.
 *
 * ```text
 * owl      Hibou              avec aigrettes
 * duck     Canard             ronde et large
 * parrot   Perroquet          plumes latérales
 * crow     Corbeau            anguleuse
 * cute     Oiseau mignon      ronde
 * slim     Oiseau fin         élancée
 * ```
 */
export const PILOT_SPECIES = Object.freeze(['owl', 'duck', 'parrot', 'crow', 'cute', 'slim']);

/**
 * Where a planned drawing is between "somebody should draw this" and "the
 * library has it". Pilot vocabulary only: no face part carries it, and nothing
 * in the editor reads it.
 */
export const PILOT_STATUSES = Object.freeze(['needs-art', 'candidate', 'approved', 'rejected']);

/** The order the validation sheets are drawn in, coarse to fine. */
export const PILOT_REVIEW_GROUPS = Object.freeze(['heads', 'eyes', 'brows', 'beaks', 'crests', 'accessories']);

/**
 * What an existing drawing is worth to this pilot.
 *
 * ```text
 * reuse           a recipe names it, or the planche draws something it already is
 * possible-reuse  it may work; the first sheet decides
 * replace         a bird needs its own, and this one cannot stand in
 * not-relevant    nothing in this pilot would ever reach for it
 * ```
 */
export const PILOT_REUSE_VERDICTS = Object.freeze(['reuse', 'possible-reuse', 'replace', 'not-relevant']);

/**
 * One planned drawing. Everything optional has a default, so a row's table
 * below says only what varies.
 */
const asset = (entry) => Object.freeze({
  species: Object.freeze([]), tags: Object.freeze([]), capabilities: Object.freeze([]),
  // MASC-12B drew all thirty. They are `candidate`: the drawing exists and
  // nobody has signed it off, which is what `npm run face:assets` is for.
  morphologies: Object.freeze([PILOT_MORPHOLOGY]), priority: 'pilot', status: 'candidate',
  distinct: '', turn: 'category-default', notes: '',
  // A piece no recipe names: an accessory any of the six may wear.
  catalogue: false, sheetLabel: '',
  ...entry,
  tags: Object.freeze([...(entry.tags || [])]), species: Object.freeze([...(entry.species || [])]),
  capabilities: Object.freeze([...(entry.capabilities || [])]), requiredRoles: Object.freeze([...(entry.requiredRoles || [])]),
  morphologies: Object.freeze([...(entry.morphologies || [PILOT_MORPHOLOGY])])
});

const ORDER = Object.fromEntries(PILOT_REVIEW_GROUPS.map((group, index) => [group, (index + 1) * 10]));
let seen = {};
const inGroup = (group) => { seen[group] = (seen[group] || 0) + 1; return ORDER[group] + seen[group]; };

/** A row of the planche: everything its pieces share, filled in once. */
const row = (reviewGroup, { prefix, ...shared }) => (slug, sheetLabel, proposedName, direction, species, tags, distinct, extra = {}) =>
  asset({ ...shared, id: `${prefix}.${slug}`, reviewGroup, reviewOrder: inGroup(reviewGroup), sheetLabel, proposedName, direction, species, tags, distinct, ...extra });

const head = row('heads', { prefix: 'head', slot: 'head', category: 'head', mountPoint: 'head.center', requiredRoles: ['head'], capabilities: ['headX', 'headY', 'headTilt'] });
const eyes = row('eyes', { prefix: 'eyes', slot: 'eyes', category: 'eyes', mountPoint: 'eyes', requiredRoles: ['leftEye', 'rightEye'], capabilities: ['eyeOpen'] });
const brow = row('brows', { prefix: 'eyebrows', slot: 'eyebrows', category: 'eyebrows', mountPoint: 'brows', requiredRoles: ['leftBrow', 'rightBrow'], capabilities: ['browRaise', 'browTilt'] });
// A beak installs as a **mouth**, because it is one: it opens, and `mouthOpen`
// is what opens it. The slot is what an author picks; the category is what the
// rig understands (docs/MASC_LIBRARY_BASELINE.md, MASC-01).
const beak = row('beaks', { prefix: 'mouth', slot: 'beak', category: 'mouth', mountPoint: 'mouth.center', requiredRoles: ['mouth'], capabilities: ['mouthOpen', 'smile', 'mouthWidth'] });
const crest = row('crests', { prefix: 'accessory', slot: 'crest', category: 'accessory', mountPoint: 'head.top', requiredRoles: ['element'], turn: 'needs-profile' });
// A monocle sits over one eye, so it anchors to one: `eye.right` rather than
// the `head.center` an accessory takes by default. MASC-12B drew it there and
// this line follows the drawing, which is what a manifest's anchors are for.
const worn = row('accessories', { prefix: 'accessory', slot: 'accessory', category: 'accessory', mountPoint: 'eye.right', requiredRoles: ['element'], turn: 'needs-profile' });

/**
 * The drawings the pilot needs, row by row, in the order the planche lays them
 * out, each under its own French caption.
 */
export const PILOT_ASSETS = Object.freeze([
  /* ── 1 · Fonds de tête ─────────────────────────────────────────────────
   * "6 formes de base pour têtes d'oiseaux (vue de face)": a bare feathered
   * silhouette with nothing on it, as an animal head is a bare fur one. The
   * owl's tufts and the parrot's side feathers are part of the *head* here and
   * not crests — they are the silhouette, which is what the captions say.
   */
  head('bird-owl', 'Hibou (avec aigrettes)', 'Owl head', 'A broad soft head with a feathered brow and two tufts worked into the outline.', ['owl'], ['bird', 'owl', 'broad', 'tufted'], 'The only head whose own outline carries tufts.'),
  head('bird-duck', 'Canard (ronde et large)', 'Duck head', 'Round and wide, with a smooth unbroken edge.', ['duck'], ['bird', 'duck', 'round', 'wide'], 'The widest, and the smoothest edge of the six.'),
  head('bird-parrot', 'Perroquet (plumes latérales)', 'Parrot head', 'Upright, with a fan of feathers down each side of the face.', ['parrot'], ['bird', 'parrot', 'feathered'], 'The only head with side feathers.'),
  head('bird-crow', 'Corbeau (anguleuse)', 'Crow head', 'Angular and flat-browed, narrowing to the beak.', ['crow'], ['bird', 'crow', 'angular', 'sharp'], 'The only squared silhouette.'),
  head('bird-cute', 'Oiseau mignon (ronde)', 'Cute bird head', 'A small, perfectly round head with a light edge.', ['cute'], ['bird', 'cute', 'round', 'small'], 'The roundest, and the plainest.'),
  head('bird-slim', 'Oiseau fin (élancée)', 'Slim bird head', 'Tall and narrow, tapering below the eyes.', ['slim'], ['bird', 'slim', 'tall', 'elegant'], 'The narrowest, and the only one taller than it is wide.'),

  /* ── 2 · Yeux ──────────────────────────────────────────────────────────
   * "6 styles d'yeux d'oiseaux (pupilles intégrées)" — the same caption the
   * animal planche used, and the same answer: an eye set draws its own pupils
   * and lids, there is no standalone pupils card, and `PRESET_PART_ORDER` does
   * not let a preset name one.
   *
   * **And the same second answer, arrived at twice.** The six were drawn, and
   * they were the shipped construction at other radii — the file's own header
   * said so, out loud, twice — so the row is answered by the library's own
   * builds rather than by a third redrawing of one ellipse
   * (docs/EYE_BUILDS.md). A bird's eye is a big round white with a disc in it,
   * which is `eyes.simple`; *Perçants* is that eye with a coloured iris, which
   * is where a crow reads intent; and *Endormis* and *Joyeux* were never
   * drawings at all — they are `eyeOpen` partway and `eyeOpen 0` with
   * `eyeCurve` up, which a control can be keyed and animated at.
   */
  eyes('simple', 'Grands ronds (style hibou)', 'Simple', 'A white, a pupil and two eyelids — the eye most mascots want.', ['owl', 'duck', 'parrot', 'cute', 'slim'], ['round', 'friendly'], 'A white and lids, where the dot has neither.',
    { standalone: false, notes: 'The library\'s own, reused. Composite: draws the gaze (leftPupil, rightPupil) and the eyelids under `parts`, as every eye set does.' }),
  eyes('iris', 'Perçants (intenses)', 'Iris', 'A coloured iris inside the white, with the pupil in it.', ['crow'], ['iris', 'intense'], 'The only build with an iris, and the only one whose eye colour is a palette token.',
    { standalone: false, notes: 'The library\'s own, reused. A crow\'s intent is the iris colour and the brow above it, not a narrower white.' }),
  eyes('dot', 'Simplistes', 'Dot', 'A pupil and nothing else: no white, no lid, no outline.', [], ['dot', 'minimal'], 'The only build with no eye white.',
    { standalone: false, catalogue: true, notes: 'The library\'s own, reused. No bird here wears it; a mascot that wants the fewest possible lines does.' }),

  /* ── 3 · Formes d'yeux / sourcils ──────────────────────────────────────
   * "5 styles de formes d'yeux / sourcils (à superposer)" — *to overlay*,
   * which is precisely what a brow is in this library: a pair above the eyes,
   * drawn on its own, raising and tilting with `browRaise` and `browTilt`.
   * Five for six species, so one is shared, which is the pilot's whole point.
   */
  brow('bird-angry', 'En colère (froncés)', 'Angry', 'Heavy and driven down towards the beak.', ['crow'], ['bird', 'angry', 'furrowed'], 'The only pair low at the inner end.'),
  brow('bird-curious', 'Curieux (haussés)', 'Curious', 'Lifted high and clear of the eye.', ['duck', 'parrot'], ['bird', 'curious', 'raised'], 'The highest of the five.'),
  brow('bird-relaxed', 'Endormis (détendus)', 'Relaxed', 'Level and close over the eye.', ['owl'], ['bird', 'relaxed', 'level'], 'The flattest, and the closest to the eye.'),
  brow('bird-happy', 'Joyeux (courbés)', 'Happy', 'Two soft arcs, lifted in the middle.', ['cute'], ['bird', 'happy', 'curved'], 'The only pair arched rather than straight.'),
  brow('bird-sharp', 'Perçants (anguleux)', 'Sharp', 'Angular, with a hard corner at the outer end.', ['slim'], ['bird', 'sharp', 'angular'], 'The only pair with a corner in it.'),

  /* ── 4 · Becs ──────────────────────────────────────────────────────────
   * The slot that makes a bird, and the first drawings it has ever had. A beak
   * installs as a `mouth` and keeps every control one has: `mouthOpen` opens
   * it, `smile` and `mouthWidth` shape it, and no new control is added.
   *
   * The planche binds no beak to a head — it draws six of each and leaves the
   * pairing to whoever combines them — so the recipes below pair them for the
   * face they make rather than for the mood in the caption.
   */
  beak('beak-owl', 'Bec hibou (court et rond)', 'Owl beak', 'Short and rounded, hooking down to a small point.', ['owl'], ['bird', 'owl', 'short', 'hooked'], 'The shortest, and the only round-shouldered one.'),
  beak('beak-duck', 'Bec canard (plat et large)', 'Duck beak', 'Flat and wide, rounded at the end: the only bill on the sheet.', ['duck'], ['bird', 'duck', 'flat', 'wide'], 'The only one wider than it is deep.'),
  beak('beak-parrot', 'Bec perroquet (courbé)', 'Parrot beak', 'A deep curved hook, the upper mandible over the lower.', ['parrot'], ['bird', 'parrot', 'curved', 'hooked'], 'The only one drawn as two mandibles.'),
  beak('beak-crow', 'Bec corbeau (pointu moyen)', 'Crow beak', 'A straight tapered point of medium length.', ['crow'], ['bird', 'crow', 'pointed'], 'The straightest, and the longest point.'),
  beak('beak-small', 'Petit bec (mignon)', 'Small beak', 'A tiny diamond, barely off the face.', ['slim'], ['bird', 'small', 'neat'], 'The smallest of the six.'),
  beak('beak-wide', 'Bec large (amical)', 'Wide beak', 'A broad open diamond, friendly rather than sharp.', ['cute'], ['bird', 'wide', 'friendly'], 'The largest diamond; broader than the small beak and blunter than the crow\'s.'),

  /* ── 5 · Crêtes / plumes ───────────────────────────────────────────────
   * "6 styles de crêtes ou plumages de dessus de tête" — what a bird has
   * instead of hair, and the second slot that makes one. There is no hair slot
   * in a `beak` face at all, which is also the answer to MASC-09's question
   * about where a crest anchors: see `crest-anchor` below.
   */
  crest('crest-owl-tufts', 'Aigrettes hibou (pointues)', 'Owl tufts', 'Two pointed tufts, one each side of the crown.', ['owl'], ['bird', 'owl', 'tufts', 'pointed'], 'The only crest that is a pair rather than one piece.'),
  crest('crest-simple', 'Crête simple (3 plumes)', 'Simple crest', 'Three plain feathers standing straight up.', ['slim'], ['bird', 'simple', 'feathers'], 'Exactly three feathers, all the same.'),
  crest('crest-messy-tuft', 'Touffe ébouriffée (désordonnée)', 'Messy tuft', 'A ragged spray of short feathers, no two alike.', ['crow'], ['bird', 'messy', 'ruffled'], 'The only untidy one.'),
  crest('crest-smooth-feather', 'Plume lisse (simple)', 'Smooth feather', 'One smooth leaf-shaped feather lying back.', ['duck'], ['bird', 'smooth', 'single'], 'One feather, and the only crest with a closed outline.'),
  crest('crest-parrot-tall', 'Crête perroquet (haute)', 'Parrot crest', 'A tall fan of long feathers, the highest thing on any face here.', ['parrot'], ['bird', 'parrot', 'tall', 'fan'], 'The tallest by far.'),
  crest('crest-round-tuft', 'Touffe ronde (mignonne)', 'Round tuft', 'A small soft round tuft, barely clear of the crown.', ['cute'], ['bird', 'round', 'small', 'cute'], 'The shortest, and the only one with no point on it.'),

  /* ── 6 · Accessoires ───────────────────────────────────────────────────
   * "4 accessoires simples et compatibles", and compatible is what the
   * library's accessories already are. Two of the four exist and are reused
   * whole; only the monocle has to be drawn. See `PILOT_REUSE`.
   */
  worn('monocle', 'Monocle (distingué)', 'Monocle', 'A single rimmed lens over one eye, on a fine chain.', [], ['monocle', 'distinguished', 'lens'], 'The only eyewear on one eye rather than two.',
    { catalogue: true, notes: 'Universal, not bird-only: a monocle suits a person and a bear as well. It ships without `morphologies`, unlike everything else in this pilot.', morphologies: [] })
]);
seen = {};

/**
 * What the shipped library is worth to a bird.
 *
 * The happiest audit of the three, and for a structural reason: an accessory
 * that says nothing is universal, so a drawing made for a person is already a
 * drawing made for a bird. The face parts are a different story — a beak is not
 * a mouth with a different outline — but the things a mascot *wears* carry over
 * whole.
 */
export const PILOT_REUSE = Object.freeze([
  Object.freeze({ id: 'accessory.glasses', verdict: 'reuse', why: 'This *is* the planche\'s Lunettes rondes: a round pair, universal, already drawn. Nothing in row 6 needs making for it.' }),
  Object.freeze({ id: 'accessory.bow-tie', verdict: 'reuse', why: 'And this is Nœud papillon, down to the shape. The accessories row is four pieces of which two already exist.' }),
  Object.freeze({ id: 'accessory.hat', verdict: 'possible-reuse', why: 'The planche\'s Petit chapeau is a small stylised topper and the shipped hat is a larger one. Whether one drawing serves both is the `small-hat-or-the-shipped-one` question, and the accessories sheet decides it.' }),
  Object.freeze({ id: 'accessory.square-glasses', verdict: 'possible-reuse', why: 'Not on the planche, and no reason a bird may not wear them: the row is captioned compatible, and a square frame is as compatible as a round one.' }),
  Object.freeze({ id: 'accessory.earring', verdict: 'not-relevant', why: 'It hosts inside an ear element, and a `beak` face has no ears slot at all.' }),
  Object.freeze({ id: 'accessory.earring-right', verdict: 'not-relevant', why: 'The other side of the same answer.' }),
  Object.freeze({ id: 'ears.round', verdict: 'not-relevant', why: 'A bird has no ears to draw, and the morphology does not offer the row. Nothing here would ever reach for a pair.' }),
  Object.freeze({ id: 'head.round', verdict: 'replace', why: 'A bare skull of skin, with a jaw that drops. A bird head is feathered and its jaw is the beak, which is a separate piece; no palette makes one out of the other.' }),
  Object.freeze({ id: 'eyes.simple', verdict: 'reuse', why: 'A white, a pupil and two lids: the planche\'s Grands ronds at the scale an owl wants. The eyes sheet asked whether a bird needed its own and the answer, in the end, was no.' }),
  Object.freeze({ id: 'eyes.iris', verdict: 'reuse', why: 'The same eye with a coloured iris, which is the planche\'s Perçants: a crow reads intent through the colour of its eye and the brow over it, not through a narrower white.' }),
  Object.freeze({ id: 'eyebrows.thin', verdict: 'possible-reuse', why: 'A thin arc reads as a bird brow as readily as a human one. The brows sheet decides whether five new pairs are five or fewer.' }),
  Object.freeze({ id: 'nose.dot', verdict: 'not-relevant', why: 'A `beak` face offers no nose slot: the beak is the whole of what is between the eyes and the chin.' }),
  Object.freeze({ id: 'mouth.small', verdict: 'replace', why: 'A beak installs *as* a mouth, so this is the drawing it replaces rather than one it sits beside. A lip line on a bird reads as a mistake.' }),
  Object.freeze({ id: 'hair.short', verdict: 'not-relevant', why: 'There is no hair slot in a `beak` face; the crest is what stands where hair would.' }),
  Object.freeze({ id: 'facialhair.beard', verdict: 'not-relevant', why: 'Nothing in this pilot would ever reach for one, and the morphology offers no row for it.' })
]);

/**
 * Colours, as palettes rather than as drawings.
 *
 * Six plumages following the planche's own head colours. No new token: a bird's
 * feather is `skin`, its shading `skinShadow`, its outline `outline`; the beak
 * takes `accessoryPrimary` and the crest `accessorySecondary`, because both are
 * the parts a bird is *coloured* by rather than parts it is made of.
 *
 * `hair` and `hairShadow` paint nothing — there is no hair slot in a `beak`
 * face — and `tongue` and `teeth` paint nothing either, because a beak has
 * neither. They are left out here, as the other two pilots leave out what their
 * kind of face has no surface for; a registered palette carries all twelve, so
 * MASC-12B fills them in at registration.
 */
export const PILOT_PALETTES = Object.freeze({
  'bird-owl-cream': Object.freeze({ species: 'owl', skin: '#f0e2cd', skinShadow: '#d8c4a6', outline: '#8a6f4e', eyeWhite: '#ffffff', pupil: '#3a2c1e', mouth: '#c98a3c', accessoryPrimary: '#c98a3c', accessorySecondary: '#d8c4a6' }),
  'bird-duck-cream': Object.freeze({ species: 'duck', skin: '#f5efe2', skinShadow: '#ddd3c0', outline: '#8f8368', eyeWhite: '#ffffff', pupil: '#2f2a22', mouth: '#f2c230', accessoryPrimary: '#f2c230', accessorySecondary: '#e8dcc4' }),
  'bird-parrot-orange': Object.freeze({ species: 'parrot', skin: '#e8613c', skinShadow: '#c4482a', outline: '#7d2a16', eyeWhite: '#ffffff', pupil: '#2a1a12', mouth: '#cfd3d6', accessoryPrimary: '#cfd3d6', accessorySecondary: '#f2c230' }),
  'bird-crow-slate': Object.freeze({ species: 'crow', skin: '#6f767c', skinShadow: '#565c61', outline: '#2f3438', eyeWhite: '#ffffff', pupil: '#1e2225', mouth: '#3f4548', accessoryPrimary: '#3f4548', accessorySecondary: '#565c61' }),
  'bird-cute-blue': Object.freeze({ species: 'cute', skin: '#9fcdf0', skinShadow: '#7fb2dc', outline: '#3f6b93', eyeWhite: '#ffffff', pupil: '#26333f', mouth: '#f0a23c', accessoryPrimary: '#f0a23c', accessorySecondary: '#f4a7c0' }),
  'bird-slim-amber': Object.freeze({ species: 'slim', skin: '#f0a94e', skinShadow: '#d88c34', outline: '#8a521c', eyeWhite: '#ffffff', pupil: '#2f2114', mouth: '#e07a2c', accessoryPrimary: '#e07a2c', accessorySecondary: '#f2c230' })
});

/**
 * The six recipes, written in the shape a real preset is written in.
 *
 * A bird names **four parts and one accessory**: a head, a pair of eyes, a pair
 * of brows, a beak — which is the `mouth` key, because that is the category a
 * beak installs through — and a crest. No nose, no ears, no hair, no facial
 * hair: the `beak` morphology offers none of them, and this is what that looks
 * like written out.
 *
 * The sharing is one pair of brows across the duck and the parrot: five brows
 * for six birds, which the planche itself sets up by drawing five.
 */
export const PILOT_PRESETS = Object.freeze([
  Object.freeze({
    id: 'owl', proposedName: 'Owl', species: 'owl', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Wide and watchful: a broad tufted head, the biggest eyes on the sheet, a level brow close over them, a short hooked beak and two pointed aigrettes.',
    tags: Object.freeze(['owl', 'bird']),
    parts: Object.freeze({ head: 'head.bird-owl', eyes: 'eyes.simple', eyebrows: 'eyebrows.bird-relaxed', mouth: 'mouth.beak-owl' }),
    accessories: Object.freeze(['accessory.crest-owl-tufts']), palette: 'bird-owl-cream'
  }),
  Object.freeze({
    id: 'duck', proposedName: 'Duck', species: 'duck', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Round, wide and friendly: a smooth head, soft eyes, brows lifted clear of them, the flat bill, and one smooth feather lying back.',
    tags: Object.freeze(['duck', 'bird']),
    parts: Object.freeze({ head: 'head.bird-duck', eyes: 'eyes.simple', eyebrows: 'eyebrows.bird-curious', mouth: 'mouth.beak-duck' }),
    accessories: Object.freeze(['accessory.crest-smooth-feather']), palette: 'bird-duck-cream'
  }),
  Object.freeze({
    id: 'parrot', proposedName: 'Parrot', species: 'parrot', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Upright and loud: side feathers down the face, bright alert eyes, raised brows, the hooked bill and the tall fan crest.',
    tags: Object.freeze(['parrot', 'bird']),
    parts: Object.freeze({ head: 'head.bird-parrot', eyes: 'eyes.simple', eyebrows: 'eyebrows.bird-curious', mouth: 'mouth.beak-parrot' }),
    accessories: Object.freeze(['accessory.crest-parrot-tall']), palette: 'bird-parrot-orange'
  }),
  Object.freeze({
    id: 'crow', proposedName: 'Crow', species: 'crow', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Angular and unimpressed: a squared head, narrowed eyes, brows driven down towards the beak, a straight point, and a ragged tuft.',
    tags: Object.freeze(['crow', 'corvid', 'bird']),
    parts: Object.freeze({ head: 'head.bird-crow', eyes: 'eyes.iris', eyebrows: 'eyebrows.bird-angry', mouth: 'mouth.beak-crow' }),
    accessories: Object.freeze(['accessory.crest-messy-tuft']), palette: 'bird-crow-slate'
  }),
  Object.freeze({
    id: 'cute-bird', proposedName: 'Cute bird', species: 'cute', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Small and delighted: a perfectly round head, happy eyes with two highlights, arched brows, a broad friendly beak and a soft round tuft.',
    tags: Object.freeze(['cute', 'bird', 'small']),
    parts: Object.freeze({ head: 'head.bird-cute', eyes: 'eyes.simple', eyebrows: 'eyebrows.bird-happy', mouth: 'mouth.beak-wide' }),
    accessories: Object.freeze(['accessory.crest-round-tuft']), palette: 'bird-cute-blue'
  }),
  Object.freeze({
    id: 'slim-bird', proposedName: 'Slim bird', species: 'slim', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Tall and elegant: a narrow head, heavy lids, a brow with a corner in it, the smallest beak, and three plain feathers straight up.',
    tags: Object.freeze(['slim', 'bird', 'elegant']),
    parts: Object.freeze({ head: 'head.bird-slim', eyes: 'eyes.simple', eyebrows: 'eyebrows.bird-sharp', mouth: 'mouth.beak-small' }),
    accessories: Object.freeze(['accessory.crest-simple']), palette: 'bird-slim-amber'
  })
]);

/**
 * What the drawings have to settle, written down so MASC-12B does not have to
 * rediscover it.
 *
 * None of these blocks. That is the difference between this pilot and the robot
 * one, and it is worth saying out loud: MASC-01 drew the `beak` morphology
 * correctly — six rows, six slots, no table to amend — so every question below
 * is about a drawing rather than about the shape of the library.
 */
export const PILOT_OPEN_QUESTIONS = Object.freeze([
  Object.freeze({
    id: 'crest-anchor', about: 'crests',
    question: 'MASC-09 left the crest with two candidate anchors and said the first real crest would decide: `head.top` is the skull, and `hair.top` is the top of whatever hair the face has — which on a bird *is* the crest (docs/FACE_ASSET_AUTHORING.md).',
    proposal: '`head.top`, and the argument settles it rather than the drawings: a `beak` face offers no hair slot at all, so `hair.top` would be an anchor measured from something that can never be there. A crest anchored to absent hair is a crest anchored to nothing. Draw all six at `head.top` and MASC-09\'s question is closed.'
  }),
  Object.freeze({
    id: 'beak-opens-as-a-mouth', about: 'beaks',
    question: 'A beak installs as a `mouth` and claims `mouthOpen`, `smile` and `mouthWidth`. A person\'s mouth opens by redrawing a lip; a beak opens by the two mandibles parting, which is two elements moving apart rather than one shape changing.',
    proposal: 'Draw each beak as an upper and a lower mandible in one group, and let `mouthOpen` rotate or translate the lower one — the roles the category needs are satisfied by the group, exactly as `mouth.animal-open-friendly` names a tongue beside its mouth. Check on the beaks sheet that a two-part mouth still validates and still reads shut at rest.'
  }),
  Object.freeze({
    id: 'owl-tufts-versus-crest', about: 'heads',
    question: 'The owl head is captioned "avec aigrettes" and the crests row also draws "Aigrettes hibou". So the tufts appear twice: once as part of the head silhouette and once as a separate crest.',
    proposal: 'The head carries them as silhouette and the crest carries them as a piece, and both are wanted: an author who puts the owl crest on the duck head should get tufts, and the owl head should read as an owl with nothing on it. Draw the head\'s tufts short and the crest\'s tall, so the Owl recipe wearing both reads as one bird rather than as four ears.'
  }),
  Object.freeze({
    id: 'parrot-side-feathers', about: 'heads',
    question: 'The parrot head is captioned "plumes latérales" — feathers down each side of the face, outside the skull outline. The head is what the 2.5D turn measures the face\'s scale from, and what a clip is cut from.',
    proposal: 'Keep the feathers inside the head\'s own reference box and check on the heads sheet that the box still measures something sensible — the animal pack\'s tufted fur edge is the precedent, and it measured fine. If the feathers push the box wide enough to shrink the face on a fit, they become a crest instead.'
  }),
  Object.freeze({
    id: 'small-hat-or-the-shipped-one', about: 'accessories',
    question: 'Row 6 draws four accessories; `accessory.glasses` *is* Lunettes rondes and `accessory.bow-tie` *is* Nœud papillon, so two are already made. The monocle is clearly new. The Petit chapeau is a small stylised topper and the shipped `accessory.hat` is a larger one.',
    proposal: 'Wear the shipped hat on all six birds on the accessories sheet and look. If it dominates a small round head, a smaller one is one more drawing and a cheap one; if it reads, the row costs exactly one drawing, which is the monocle.'
  }),
  Object.freeze({
    id: 'monocle-is-universal', about: 'accessories',
    question: 'Everything else in this pilot says `morphologies: [\'beak\']`, because an owl\'s beak on a person is not a look anybody asked for. A monocle is not like that.',
    proposal: 'It ships with no `morphologies` at all — universal, as the six accessories already in the library are. The row is captioned "compatibles" and the library reads an empty field as every kind of face, so this costs nothing and is the honest reading.'
  }),
  Object.freeze({
    id: 'crest-turn-profile', about: 'crests',
    question: 'An accessory that says nothing about the 2.5D turn does not turn at all. The six crests stand above the crown, some of them well above it.',
    proposal: 'The robot antennae are the nearest precedent at `depth 0.35`, and they stand off the head in the same way. The parrot crest is the tallest thing in the library after the rabbit\'s ears, so check it against the artboard\'s sixty units of headroom before drawing the other five.'
  }),
  Object.freeze({
    id: 'brows-over-a-feathered-head', about: 'brows',
    question: 'The planche calls row 3 "formes d\'yeux / sourcils (à superposer)" — overlay shapes that are half brow and half eye-shape. A bird has no eyebrow in life, and drawn too heavily they read as a second pair of lids.',
    proposal: 'Draw them as brows: a pair above the eyes, thin, clear of the lid. `browRaise` and `browTilt` are what the category gives and what the five moods need. If the sheet says they read as lids, they are drawn thinner rather than moved into the eye sets.'
  })
]);

/* ── Reading the manifest ─────────────────────────────────────────────── */

const byId = new Map(PILOT_ASSETS.map((item) => [item.id, item]));

/**
 * The planned drawings, narrowed.
 * @param {{ group?, slot?, species?, status? }} [query]
 */
export function pilotAssets({ group = null, slot = null, species = null, status = null } = {}) {
  return PILOT_ASSETS.filter((item) => (!group || item.reviewGroup === group)
    && (!slot || item.slot === slot)
    && (!species || item.species.includes(species))
    && (!status || item.status === status))
    .slice().sort((a, b) => a.reviewOrder - b.reviewOrder);
}

/** One planned drawing, or null. */
export const pilotAsset = (id) => byId.get(String(id ?? '')) || null;

/** The planned drawings for one visual slot. */
export const pilotAssetsForSlot = (slot) => pilotAssets({ slot });

/** The planned drawings one bird needs. */
export const pilotAssetsForSpecies = (species) => pilotAssets({ species });

/** One recipe, or null. */
export const pilotPreset = (id) => PILOT_PRESETS.find((item) => item.id === String(id ?? '')) || null;

/** What an existing drawing is worth to the pilot, or null for one nobody looked at. */
export const pilotReuse = (id) => PILOT_REUSE.find((item) => item.id === String(id ?? '')) || null;

/** Every id a recipe names. */
export const presetAssetIds = (preset) => [...Object.values(preset?.parts || {}), ...(preset?.accessories || [])];

/**
 * What a recipe puts on a face, row by row — with the beak under `beak` rather
 * than under `mouth`, which is how an author thinks of it, and the four rows a
 * bird has not got answered as null rather than left out.
 *
 * @returns {Record<string, string|null>} row → asset id
 */
export function presetCoverage(id) {
  const preset = pilotPreset(id);
  if (!preset) return null;
  return {
    head: preset.parts.head, eyes: preset.parts.eyes, eyebrows: preset.parts.eyebrows,
    beak: preset.parts.mouth,
    crest: preset.accessories.find((assetId) => pilotAsset(assetId)?.slot === 'crest') || null,
    // A bird has none of these, and the morphology offers no row for any of
    // them. Answering null says so; leaving them out would leave the caller to
    // guess whether it was an omission.
    nose: null, ears: null, hair: null, facialHair: null
  };
}

/** The pilot in one line, for the report and for a test to hold it to. */
export const pilotSummary = () => ({
  drawings: PILOT_ASSETS.length,
  onSheet: PILOT_ASSETS.length + PILOT_REUSE.filter((item) => item.verdict === 'reuse').length,
  reused: PILOT_REUSE.filter((item) => item.verdict === 'reuse').length,
  catalogue: PILOT_ASSETS.filter((item) => item.catalogue).length,
  species: PILOT_SPECIES.length,
  presets: PILOT_PRESETS.length,
  palettes: Object.keys(PILOT_PALETTES).length,
  blocking: PILOT_OPEN_QUESTIONS.filter((item) => item.blocking).length,
  drawn: PILOT_ASSETS.filter((item) => item.status === 'candidate').length,
  groups: Object.fromEntries(PILOT_REVIEW_GROUPS.map((group) => [group, pilotAssets({ group }).length]))
});
