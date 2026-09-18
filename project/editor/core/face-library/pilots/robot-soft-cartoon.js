/**
 * The brief for the first robot faces (MASC-11A; docs/ROBOT_SOFT_CARTOON_PILOT.md).
 *
 * ```text
 * morphology   robot
 * style        soft-cartoon — the style the library is drawn in
 * types        Écran · Rétro · Industriel · Jouet
 * ```
 *
 * **Nothing here is a face part, and nothing here is registered.** This is a
 * data-only cahier des charges, the sibling of `muzzle-soft-cartoon.js`: what
 * has to be drawn, which slot and anchor each piece uses, which of the shipped
 * drawings can stand in, and which of the four recipes each piece is in.
 * `BUILTIN_FACE_PARTS` and `FACE_PRESET_LIBRARY` are untouched.
 *
 * The rule is the one the animals proved:
 *
 * ```text
 * shared parts  +  type-specific parts  +  preset recipe
 * ```
 *
 * The four types are **presets inside `robot`**, exactly as Cat and Fox are
 * presets inside `muzzle`. A morphology is what a face is made of; a preset is
 * what it looks like. Nothing here adds a morphology, and — this is the whole
 * point of MASC-01 through MASC-09 holding — nothing here adds a slot either:
 * the planche's seven rows land on seven slots that already exist, two of them
 * (`antenna`, `panels`) drawn for the first time.
 *
 * ## What the planche labels, and what that is worth in drawings
 *
 * The sheet lays out 7 rows × 4 types = **28 labelled families**, and draws
 * **three variants of each**, 84 cells in all. It labels the family, never the
 * variant — `head.retro-square` names a cell showing a cream box, a green box
 * and a red box.
 *
 * Which is the pilot's first question, because this library has a rule about
 * that: **a colour is a palette, not a drawing.** A ginger cat and a grey cat
 * are one drawing; a cream robot and a red robot should be too. Where three
 * variants differ only in colour, there is one drawing and three palette
 * entries. Where they differ in shape or in detail, there are three drawings.
 *
 * So the inventory below is **28 drawings, and up to 84** — one id per family,
 * with `variants: 3` recording what the planche shows and `variantAxis`
 * recording how they seem to differ. The axis is a *reading of the image*, not
 * a fact; the first review sheet settles each one, and a family whose variants
 * turn out to be real takes `-b` and `-c` alongside it.
 *
 * Every id below is a proposal. MASC-11B draws them, runs each through
 * `npm run face:assets` (docs/FACE_ASSET_AUTHORING.md), and registers what
 * survives.
 */
import { FACE_BASE_STYLE_ID } from '../face-styles.js';

export const PILOT_ID = 'robot-soft-cartoon';
export const PILOT_MORPHOLOGY = 'robot';
export const PILOT_STYLE = FACE_BASE_STYLE_ID;

/** The art direction this manifest follows, row for row. */
export const PILOT_SHEET = 'Soft Cartoon — Bibliothèque Robot V1 (ROBOT-V1)';

/**
 * The four kinds of robot the planche dresses. Each is a **preset inside
 * `robot`**, never a morphology.
 *
 * The planche's own one-liners, which are the art direction in three words:
 *
 * ```text
 * screen      Lisible · Expressif · Moderne
 * retro       Vintage · Sympathique · Carré
 * industrial  Solide · Technique · Robuste
 * toy         Doux · Simple · Attachant
 * ```
 */
export const PILOT_TYPES = Object.freeze(['screen', 'retro', 'industrial', 'toy']);

/**
 * Where a planned drawing is between "somebody should draw this" and "the
 * library has it". Pilot vocabulary only: no face part carries it, and nothing
 * in the editor reads it.
 */
export const PILOT_STATUSES = Object.freeze(['needs-art', 'candidate', 'approved', 'rejected']);

/** The order the validation sheets are drawn in, coarse to fine. */
export const PILOT_REVIEW_GROUPS = Object.freeze(['shells', 'sides', 'eyes', 'visors', 'mouths', 'antennae', 'panels']);

/**
 * How the three variants of one labelled family seem to differ, read off the
 * planche. The first review sheet confirms or corrects each.
 *
 * ```text
 * shape   three silhouettes: three drawings
 * detail  one silhouette, different fittings on it: three drawings
 * colour  one drawing, three palette entries
 * ```
 */
export const PILOT_VARIANT_AXES = Object.freeze(['shape', 'detail', 'colour']);

/**
 * What an existing drawing is worth to this pilot.
 *
 * ```text
 * reuse           a recipe names it: nothing is drawn for that role
 * possible-reuse  it may work; the first sheet decides
 * replace         a robot needs its own, and this one cannot stand in
 * not-relevant    nothing in this pilot would ever reach for it
 * ```
 */
export const PILOT_REUSE_VERDICTS = Object.freeze(['reuse', 'possible-reuse', 'replace', 'not-relevant']);

/**
 * One planned drawing. Everything optional has a default, so a row's table
 * below says only what varies.
 */
const asset = (entry) => Object.freeze({
  types: Object.freeze([]), tags: Object.freeze([]), capabilities: Object.freeze([]),
  morphologies: Object.freeze([PILOT_MORPHOLOGY]), priority: 'pilot', status: 'candidate',
  variants: 3, variantAxis: 'shape', distinct: '', turn: 'category-default', notes: '',
  // MASC-11B drew all twenty-eight: one per family, which is the floor of the
  // range above. They are `candidate` -- the drawing exists and nobody has
  // signed it off -- and whether each family's other two variants become
  // drawings or palette entries is what the review sheets settle.
  catalogue: false, sheetLabel: '', sheetId: '',
  ...entry,
  tags: Object.freeze([...(entry.tags || [])]), types: Object.freeze([...(entry.types || [])]),
  capabilities: Object.freeze([...(entry.capabilities || [])]), requiredRoles: Object.freeze([...(entry.requiredRoles || [])]),
  morphologies: Object.freeze([...(entry.morphologies || [PILOT_MORPHOLOGY])])
});

const ORDER = Object.fromEntries(PILOT_REVIEW_GROUPS.map((group, index) => [group, (index + 1) * 10]));
let seen = {};
const inGroup = (group) => { seen[group] = (seen[group] || 0) + 1; return ORDER[group] + seen[group]; };

/** A row of the planche: everything its four families share, filled in once. */
const row = (reviewGroup, { prefix, ...shared }) => (slug, sheetLabel, sheetId, proposedName, type, direction, distinct, tags, extra = {}) =>
  asset({ ...shared, id: `${prefix}.${slug}`, reviewGroup, reviewOrder: inGroup(reviewGroup), sheetLabel, sheetId, proposedName, types: [type], direction, distinct, tags, ...extra });

const shell = row('shells', { prefix: 'head', slot: 'head', category: 'head', mountPoint: 'head.center', requiredRoles: ['head'], capabilities: ['headX', 'headY', 'headTilt'] });
const side = row('sides', { prefix: 'ears', slot: 'ears', category: 'ears', mountPoint: 'ears', requiredRoles: ['leftEar', 'rightEar'], capabilities: ['earWiggle'], turn: 'needs-profile' });
const eyes = row('eyes', { prefix: 'eyes', slot: 'eyes', category: 'eyes', mountPoint: 'eyes', requiredRoles: ['leftEye', 'rightEye'], capabilities: ['eyeOpen'] });
const visor = row('visors', { prefix: 'eyebrows', slot: 'eyebrows', category: 'eyebrows', mountPoint: 'brows', requiredRoles: ['leftBrow', 'rightBrow'], capabilities: ['browRaise', 'browTilt'] });
const mouth = row('mouths', { prefix: 'mouth', slot: 'mouth', category: 'mouth', mountPoint: 'mouth.center', requiredRoles: ['mouth'], capabilities: ['mouthOpen', 'smile', 'mouthWidth'] });
const antenna = row('antennae', { prefix: 'accessory', slot: 'antenna', category: 'accessory', mountPoint: 'head.top', requiredRoles: ['element'], turn: 'needs-profile' });
const panels = row('panels', { prefix: 'accessory', slot: 'panels', category: 'accessory', mountPoint: 'head.center', requiredRoles: ['element'], turn: 'needs-profile' });

/**
 * The drawings the pilot needs, row by row, in the order the planche lays them
 * out. `sheetId` is the id the planche itself prints — kept verbatim, because
 * the planche's footnote says those names are indicative and the library's own
 * prefixes win, and keeping both means the two can always be lined up.
 */
export const PILOT_ASSETS = Object.freeze([
  /* ── 1 · Coques de tête ────────────────────────────────────────────────
   * "Pièces séparées par type de mascotte". A shell is the whole skull: the
   * bezel, the face plate and nothing on it. Every fitting — the lights, the
   * grille, the warning stripe — is its own piece, which is the shape the rest
   * of this library already has.
   *
   * A shell is rigid, and that is the one place a robot head differs from
   * every head the library ships: see the `shell-has-no-jaw` question.
   */
  shell('robot-screen-rounded', 'Coque de tête · Écran', 'head.screen-rounded', 'Screen shell', 'screen',
    'A wide rounded shell in a pale bezel, its whole face a dark screen the eyes and mouth are drawn on.',
    'The only shell whose face is one continuous dark panel.', ['robot', 'screen', 'rounded', 'modern'],
    { variantAxis: 'shape', notes: 'The three cells differ in proportion: wide, standard, narrow. Read as shape, to confirm.' }),
  shell('robot-retro-square', 'Coque de tête · Rétro', 'head.retro-square', 'Retro shell', 'retro',
    'A square caisson with soft corners and a panel seam across the top.',
    'Square where the others are round; the only one with a visible seam.', ['robot', 'retro', 'square', 'vintage'],
    { variantAxis: 'colour', notes: 'The three cells are cream, sage and red at one silhouette. If that holds, this is one drawing and three palettes.' }),
  shell('robot-industrial-plate', 'Coque de tête · Industriel', 'head.industrial-plate', 'Industrial shell', 'industrial',
    'A bolted metal plate with a handle across the crown, heavier and squarer than the retro caisson.',
    'The only shell with bolts and a carrying handle.', ['robot', 'industrial', 'plate', 'robust'],
    { variantAxis: 'detail', notes: 'Bare plate, plate with handle, plate with a hazard stripe. The stripe is a `panels` piece, not a shell — see the `stripe-belongs-to-panels` question.' }),
  shell('robot-toy-round', 'Coque de tête · Jouet', 'head.toy-round', 'Toy shell', 'toy',
    'A soft round shell with a wide pale face plate, the friendliest silhouette of the four.',
    'The roundest, and the only one with no hard corner anywhere.', ['robot', 'toy', 'round', 'soft'],
    { variantAxis: 'colour', notes: 'White-and-blue, red, yellow at one silhouette. Same reading as the retro caisson.' }),

  /* ── 2 · Modules latéraux ──────────────────────────────────────────────
   * The planche's own row name, and the pilot's first mapping decision: they
   * sit where ears sit, so they install as `ears` and take `earWiggle` for
   * nothing. See the `robot-has-no-ears-slot` question — the morphology's slot
   * list does not currently offer the row at all.
   */
  side('robot-screen-round', 'Modules latéraux · Écran', 'side.screen-round', 'Screen side module', 'screen',
    'A round module a side, a lit ring around a dark centre.',
    'The only pair that is lit rather than mechanical.', ['robot', 'screen', 'round', 'lit'],
    { variantAxis: 'detail', notes: 'Ring, solid, double ring at one silhouette.' }),
  side('robot-retro-round', 'Modules latéraux · Rétro', 'side.retro-round', 'Retro side module', 'retro',
    'A drum a side on a short post, like a speaker cone bolted to the caisson.',
    'The only pair mounted on a visible post.', ['robot', 'retro', 'drum', 'speaker'],
    { variantAxis: 'colour', notes: 'Red, grey, red at one silhouette.' }),
  side('robot-industrial-bolt', 'Modules latéraux · Industriel', 'side.industrial-bolt', 'Industrial side module', 'industrial',
    'A bolted disc a side, flush with the plate and ringed with fasteners.',
    'The flattest pair: it sits against the shell rather than standing off it.', ['robot', 'industrial', 'bolt', 'disc'],
    { variantAxis: 'detail' }),
  side('robot-toy-colorful', 'Modules latéraux · Jouet', 'side.toy-colorful', 'Toy side module', 'toy',
    'A bright knob a side, a ball on a short stub.',
    'The only pair drawn as a toy knob rather than a machined part.', ['robot', 'toy', 'knob', 'bright'],
    { variantAxis: 'colour', notes: 'Blue, red, yellow-and-blue at one silhouette.' }),

  /* ── 3 · Yeux / écran ──────────────────────────────────────────────────
   * The row that decides what a robot eye *is*. MASC-10B established that an
   * eye set which brings no gaze and no eyelids cannot be swapped in over one
   * that does — the install refuses it, because it would take the pupils off
   * the face. So a robot eye is a composite like every other, and the question
   * is what plays the pupil. See `the-lit-element-is-the-pupil`.
   */
  eyes('robot-display-friendly', 'Yeux / écran · Écran', 'eyes.display-friendly', 'Friendly display', 'screen',
    'Two cyan shapes lit on the dark face plate: an upward arc, a filled disc, or a pixel block.',
    'Drawn *on* the screen rather than set into the shell.', ['robot', 'screen', 'display', 'cyan'],
    { notes: 'Composite: the lit shape is the pupil, the dark plate behind it the socket. Draws `gaze` and `eyelids` under `parts`, as every eye set does.' }),
  eyes('robot-retro-led', 'Yeux / écran · Rétro', 'eyes.retro-led', 'Retro LED', 'retro',
    'Two yellow lamps in dark bezels: round, capsule, or a small matrix of squares.',
    'Warm yellow where the screen family is cold cyan.', ['robot', 'retro', 'led', 'yellow']),
  eyes('robot-industrial-led', 'Yeux / écran · Industriel', 'eyes.industrial-led', 'Industrial LED', 'industrial',
    'Two hard indicator lights: amber discs, a red bar each, or an amber grid.',
    'The only pair with a horizontal bar option, which reads as a scowl without a brow.', ['robot', 'industrial', 'led', 'amber']),
  eyes('robot-toy-expressive', 'Yeux / écran · Jouet', 'eyes.toy-expressive', 'Toy expressive', 'toy',
    'Big cartoon eyes with a highlight — and the two shapes a toy is allowed: a heart and a star.',
    'The only pair with a true white and a glint; the only pair whose pupil is a shape rather than a light.', ['robot', 'toy', 'expressive', 'cute'],
    { notes: 'The heart and the star are the `eyes.animal-happy` case: they hold the roles and claim nothing, because a heart does not look anywhere.' }),

  /* ── 4 · Sourcils / visière ────────────────────────────────────────────
   * A visor above the eyes is a brow: it raises, it tilts, and those are the
   * two controls the category already carries. Same mapping decision as the
   * side modules, and the same missing row in the morphology's slot list.
   */
  visor('robot-screen-simple', 'Sourcils / visière · Écran', 'brow.screen-simple', 'Screen brow', 'screen',
    'A plain dark bar a side, drawn on the screen: level, angled, or curved.',
    'The lightest of the four: a bar with no fitting on it.', ['robot', 'screen', 'bar', 'simple'],
    { variantAxis: 'shape' }),
  visor('robot-retro-plate', 'Sourcils / visière · Rétro', 'brow.retro-plate', 'Retro brow plate', 'retro',
    'A blunt rectangular plate a side, sitting proud of the caisson.',
    'The bluntest: a rectangle with square ends.', ['robot', 'retro', 'plate', 'blunt'],
    { variantAxis: 'colour', notes: 'The three cells read as one plate. Likeliest merge on the sheet.' }),
  visor('robot-industrial-visor', 'Sourcils / visière · Industriel', 'brow.industrial-visor', 'Industrial visor', 'industrial',
    'A heavy curved visor across both eyes, or a bolted plate a side.',
    'The only one that spans both eyes as a single piece.', ['robot', 'industrial', 'visor', 'heavy'],
    { variantAxis: 'shape', notes: 'A one-piece visor still needs leftBrow and rightBrow roles, so it is drawn as two halves of one shape — see `a-visor-is-two-brows`.' }),
  visor('robot-toy-cute', 'Sourcils / visière · Jouet', 'brow.toy-cute', 'Toy brow', 'toy',
    'A soft curved arc a side, thick in the middle and tapered at both ends.',
    'The only pair with a tapered end.', ['robot', 'toy', 'arc', 'soft'],
    { variantAxis: 'shape' }),

  /* ── 5 · Bouche / haut-parleur ─────────────────────────────────────────
   * A robot's mouth is a speaker, and it keeps every control a mouth has:
   * `mouthOpen`, `smile` and `mouthWidth` are what a person's mouth uses and
   * what a grille uses, and no new control is added anywhere in this pack.
   */
  mouth('robot-display', 'Bouche / haut-parleur · Écran', 'mouth.display', 'Display mouth', 'screen',
    'A dark rounded panel with a cyan smile lit inside it, or a dot matrix across it.',
    'The only mouth that is lit rather than cut.', ['robot', 'screen', 'display', 'cyan']),
  mouth('robot-retro-grille', 'Bouche / haut-parleur · Rétro', 'mouth.retro-grille', 'Retro grille', 'retro',
    'A speaker grille: a plain capsule, vertical bars, or a field of holes.',
    'Vertical bars, where the industrial vent runs horizontal.', ['robot', 'retro', 'grille', 'speaker']),
  mouth('robot-industrial-vent', 'Bouche / haut-parleur · Industriel', 'mouth.industrial-vent', 'Industrial vent', 'industrial',
    'A machined vent: slots, a perforated plate, or horizontal louvres.',
    'The heaviest, and the only one framed in metal on all four sides.', ['robot', 'industrial', 'vent', 'louvre']),
  mouth('robot-toy-simple', 'Bouche / haut-parleur · Jouet', 'mouth.toy-simple', 'Toy mouth', 'toy',
    'A simple curved smile, an open pink mouth, or a small dotted panel.',
    'The only mouth drawn as a line rather than as hardware.', ['robot', 'toy', 'smile', 'simple'],
    { notes: 'The open variant names a tongue role and claims the tongue control, as mouth.cartoon does.' }),

  /* ── 6 · Antenne ───────────────────────────────────────────────────────
   * The first of the two slots that make a robot a robot. `head.top` is the
   * candidate anchor MASC-09 proposed (docs/FACE_ASSET_AUTHORING.md), and the
   * first antenna is what confirms it.
   */
  antenna('antenna-single-short', 'Antenne · Écran', 'antenna.single-short', 'Single short antenna', 'screen',
    'One short stalk with a lit ball on it, upright or leaning.',
    'One stalk, one ball: the plainest of the four.', ['robot', 'screen', 'antenna', 'single'],
    { variantAxis: 'shape' }),
  antenna('antenna-retro-multi', 'Antenne · Rétro', 'antenna.retro-multi', 'Retro multi antenna', 'retro',
    'A red ball on a stalk, a two-balled U, or a ball on a segmented mast.',
    'The only family with a two-balled variant.', ['robot', 'retro', 'antenna', 'multi'],
    { variantAxis: 'shape' }),
  antenna('antenna-industrial-robust', 'Antenne · Industriel', 'antenna.industrial-robust', 'Industrial antenna', 'industrial',
    'A stubby bolted post, a thick machined one, or a coiled mast with a brass tip.',
    'The only family with no ball at all: it is a post, not an aerial.', ['robot', 'industrial', 'antenna', 'post'],
    { variantAxis: 'shape' }),
  antenna('antenna-toy-fun', 'Antenne · Jouet', 'antenna.toy-fun', 'Toy antenna', 'toy',
    'A yellow ball, two yellow balls, or a star on a stalk.',
    'The only family whose tip is a star.', ['robot', 'toy', 'antenna', 'star'],
    { variantAxis: 'shape' }),

  /* ── 7 · Panneaux / détails ────────────────────────────────────────────
   * The second slot, and the one that behaves unlike every accessory so far: a
   * panel is drawn *on* the shell at the same anchor the shell uses, and an
   * accessory installed with nothing before it lands last in the group — which
   * is where a panel wants to be. The muzzle's problem, inverted.
   */
  panels('panels-light-panel', 'Panneaux / détails · Écran', 'panels.light-panel', 'Light panel', 'screen',
    'A pale inset panel with a lit indicator on it: a triangle, a round lamp, or a dot grid.',
    'The only panel that is itself lit.', ['robot', 'screen', 'panel', 'indicator']),
  panels('panels-retro-buttons', 'Panneaux / détails · Rétro', 'panels.retro-buttons', 'Retro buttons', 'retro',
    'A gauge dial, a perforated plate with buttons, or three coloured buttons in a row.',
    'The only panel with a dial on it.', ['robot', 'retro', 'panel', 'buttons']),
  panels('panels-warning-stripe', 'Panneaux / détails · Industriel', 'panels.warning-stripe', 'Warning stripe', 'industrial',
    'A yellow-and-black hazard stripe, a bolted plate, or an orange warning triangle.',
    'The only panel that carries a marking rather than a fitting.', ['robot', 'industrial', 'panel', 'hazard'],
    { notes: 'The hazard stripe also appears as a variant of the industrial shell. It belongs here — see `stripe-belongs-to-panels`.' }),
  panels('panels-toy-buttons', 'Panneaux / détails · Jouet', 'panels.toy-buttons', 'Toy buttons', 'toy',
    'A star badge, three coloured dots, or a rounded yellow bar.',
    'The only panel drawn as a badge rather than as instrumentation.', ['robot', 'toy', 'panel', 'badge'])
]);
seen = {};

/**
 * What the shipped library is worth to a robot.
 *
 * Short, and that is the finding: a robot shares almost nothing with a person
 * or an animal. The judgement is per *family* rather than per drawing, because
 * the answer is the same for every drawing in a category.
 */
export const PILOT_REUSE = Object.freeze([
  Object.freeze({ id: 'accessory.glasses', verdict: 'possible-reuse', why: 'A robot in glasses is a perfectly good mascot, and the drawing is universal. Nothing in the pilot needs it, but nothing stops it either.' }),
  Object.freeze({ id: 'accessory.square-glasses', verdict: 'possible-reuse', why: 'The squarer of the two frames, and the one that suits a caisson better than the round pair does. Named by no recipe, available to every one of them.' }),
  Object.freeze({ id: 'accessory.bow-tie', verdict: 'reuse', why: 'The shipped robot preset already wears it, and a bow tie suits the retro caisson. Named by no recipe here, but the first thing an author reaches for.' }),
  Object.freeze({ id: 'accessory.hat', verdict: 'possible-reuse', why: 'Universal, and it clears the antenna at `head.top` only if the two are drawn to miss each other. The antenna sheet is where that is checked.' }),
  Object.freeze({ id: 'accessory.earring', verdict: 'not-relevant', why: 'It hangs on an ear, and a robot has side modules rather than ears to hang it from.' }),
  Object.freeze({ id: 'accessory.earring-right', verdict: 'not-relevant', why: 'The other side of the same answer: it hosts inside an ear element, and a side module is not one.' }),
  Object.freeze({ id: 'head.square-soft', verdict: 'replace', why: 'The nearest shipped shape to a retro caisson, and still a skull: a soft square of skin with a jaw that drops. A shell is rigid and bolted, and no palette makes one out of the other.' }),
  Object.freeze({ id: 'eyes.simple', verdict: 'replace', why: 'The shipped robot preset used a small one of these, which is exactly the confusion this pilot exists to end: a white with a pupil in it is an eye, and a robot has a lamp.' }),
  Object.freeze({ id: 'eyebrows.flat', verdict: 'possible-reuse', why: 'A level bar is a level bar, and `eyebrows.flat` is already one. It may stand in for the screen brow; the visors sheet decides whether a robot needs its own weight.' }),
  Object.freeze({ id: 'mouth.full', verdict: 'replace', why: 'A short lip line. Every mouth here is hardware — a grille, a vent, a lit panel — and a lip on a machine reads as a mistake.' }),
  Object.freeze({ id: 'nose.cartoon', verdict: 'not-relevant', why: 'The planche has no nose row at all, and a robot preset names none. See the `a-robot-names-no-nose` question.' }),
  Object.freeze({ id: 'hair.bald', verdict: 'not-relevant', why: 'There is no hair slot in a `robot` face, and an antenna is what stands where hair would.' }),
  Object.freeze({ id: 'ears.small', verdict: 'possible-reuse', why: 'The smallest shipped pair, at the sides where a side module goes. A flesh ear on a machine is wrong, but it proves the anchor before the first module is drawn.' })
]);

/**
 * Colours, as palettes rather than as drawings.
 *
 * The planche proposes five swatches per type, and the whole colour-vs-shape
 * question above turns on this table: if a cream caisson and a red caisson are
 * one drawing, these are what tell them apart.
 *
 * No new token. A robot's shell is `skin`, its seam `skinShadow`, its edge
 * `outline`; the screen ground is `eyeWhite` and the lit element `pupil`;
 * `mouth` paints the grille ground, `tongue` the toy robot's open mouth, and
 * the antenna and panel accents take `accessoryPrimary` and
 * `accessorySecondary`.
 *
 * `hair` and `hairShadow` are the two a robot never paints — there is no hair
 * slot in a `robot` face, and an antenna stands where hair would — so they are
 * left out here, exactly as the animal pilot leaves them out. A registered
 * palette carries all twelve, so MASC-11B fills them in at registration; a
 * manifest names what it paints.
 */
export const PILOT_PALETTES = Object.freeze({
  'robot-screen': Object.freeze({ type: 'screen', skin: '#f5f7fa', skinShadow: '#d7dee6', outline: '#23272e', eyeWhite: '#23272e', pupil: '#37c9e8', mouth: '#23272e', tongue: '#37c9e8', teeth: '#f5f7fa', accessoryPrimary: '#37c9e8', accessorySecondary: '#a8d4ef' }),
  'robot-retro': Object.freeze({ type: 'retro', skin: '#f2ece0', skinShadow: '#d8d0bf', outline: '#3a3630', eyeWhite: '#3a3630', pupil: '#f2c230', mouth: '#3a3630', tongue: '#d1453f', teeth: '#f2ece0', accessoryPrimary: '#d1453f', accessorySecondary: '#7d9a72' }),
  'robot-industrial': Object.freeze({ type: 'industrial', skin: '#b6b9bc', skinShadow: '#8f9497', outline: '#33373a', eyeWhite: '#33373a', pupil: '#e08a24', mouth: '#33373a', tongue: '#9b3a30', teeth: '#b6b9bc', accessoryPrimary: '#f0c02c', accessorySecondary: '#9b3a30' }),
  'robot-toy': Object.freeze({ type: 'toy', skin: '#fdfdfd', skinShadow: '#e3e8ee', outline: '#3b4046', eyeWhite: '#ffffff', pupil: '#3b4046', mouth: '#3b4046', tongue: '#f39ab4', teeth: '#ffffff', accessoryPrimary: '#e04a48', accessorySecondary: '#f5c93f' })
});

/**
 * The four recipes, written in the shape a real preset is written in.
 *
 * Five parts and two accessories each, and **no nose and no hair** — which is
 * not an omission but what the planche draws, and what the `robot` morphology
 * already says a robot is made of.
 */
export const PILOT_PRESETS = Object.freeze([
  Object.freeze({
    id: 'robot-screen', proposedName: 'Screen robot', type: 'screen', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Lisible · Expressif · Moderne. One dark screen for a face, cyan light for everything that moves, and a single short antenna.',
    tags: Object.freeze(['robot', 'screen', 'modern']),
    parts: Object.freeze({ head: 'head.robot-screen-rounded', ears: 'ears.robot-screen-round', eyes: 'eyes.robot-display-friendly', eyebrows: 'eyebrows.robot-screen-simple', mouth: 'mouth.robot-display' }),
    accessories: Object.freeze(['accessory.antenna-single-short', 'accessory.panels-light-panel']),
    palette: 'robot-screen', alternatePalettes: Object.freeze([])
  }),
  Object.freeze({
    id: 'robot-retro', proposedName: 'Retro robot', type: 'retro', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Vintage · Sympathique · Carré. A square caisson, warm yellow lamps, a speaker grille and two aerials.',
    tags: Object.freeze(['robot', 'retro', 'vintage']),
    parts: Object.freeze({ head: 'head.robot-retro-square', ears: 'ears.robot-retro-round', eyes: 'eyes.robot-retro-led', eyebrows: 'eyebrows.robot-retro-plate', mouth: 'mouth.robot-retro-grille' }),
    accessories: Object.freeze(['accessory.antenna-retro-multi', 'accessory.panels-retro-buttons']),
    palette: 'robot-retro', alternatePalettes: Object.freeze([])
  }),
  Object.freeze({
    id: 'robot-industrial', proposedName: 'Industrial robot', type: 'industrial', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Solide · Technique · Robuste. A bolted plate, a heavy visor over amber indicators, a machined vent and a hazard stripe.',
    tags: Object.freeze(['robot', 'industrial', 'robust']),
    parts: Object.freeze({ head: 'head.robot-industrial-plate', ears: 'ears.robot-industrial-bolt', eyes: 'eyes.robot-industrial-led', eyebrows: 'eyebrows.robot-industrial-visor', mouth: 'mouth.robot-industrial-vent' }),
    accessories: Object.freeze(['accessory.antenna-industrial-robust', 'accessory.panels-warning-stripe']),
    palette: 'robot-industrial', alternatePalettes: Object.freeze([])
  }),
  Object.freeze({
    id: 'robot-toy', proposedName: 'Toy robot', type: 'toy', morphology: PILOT_MORPHOLOGY, style: PILOT_STYLE,
    direction: 'Doux · Simple · Attachant. A round shell, big cartoon eyes with a glint, a drawn smile and a star on a stalk.',
    tags: Object.freeze(['robot', 'toy', 'cute']),
    parts: Object.freeze({ head: 'head.robot-toy-round', ears: 'ears.robot-toy-colorful', eyes: 'eyes.robot-toy-expressive', eyebrows: 'eyebrows.robot-toy-cute', mouth: 'mouth.robot-toy-simple' }),
    accessories: Object.freeze(['accessory.antenna-toy-fun', 'accessory.panels-toy-buttons']),
    palette: 'robot-toy', alternatePalettes: Object.freeze([])
  })
]);

/**
 * What the drawings have to settle, written down so MASC-11B does not have to
 * rediscover it. Two of these are decisions somebody has to take before a line
 * is drawn, and they are first.
 */
export const PILOT_OPEN_QUESTIONS = Object.freeze([
  Object.freeze({
    id: 'robot-has-no-ears-slot', about: 'sides', blocking: true,
    question: 'The `robot` morphology offers `head, eyes, pupils, mouth, antenna, panels, accessory` (MASC-01, MORPHOLOGY_TABLE). The planche has a Modules latéraux row and a Sourcils / visière row, and neither `ears` nor `eyebrows` is in that list — so Design would draw them and then never offer them.',
    proposal: 'Add `ears` and `eyebrows` to the robot slot list: one line in MORPHOLOGY_TABLE, and the side modules get `earWiggle` and the visor gets `browRaise`/`browTilt` for nothing. The alternative — calling them `panels` pieces — costs the animation and gains nothing. This is MASC-01\'s table, so it is a decision and not a detail.'
  }),
  Object.freeze({
    id: 'variants-are-shapes-or-colours', about: 'shells', blocking: true,
    question: 'The planche draws three variants of each of its 28 families, 84 cells. Some clearly differ in shape (three antennae, three mouths); some look like one silhouette in three colours (the retro caisson, the toy shell). A colour is a palette in this library, not a drawing.',
    proposal: 'Read each family\'s `variantAxis` as a proposal, and settle it on that row\'s review sheet before drawing the row. `colour` means one drawing and extra palette entries; `shape` and `detail` mean three drawings taking `-b` and `-c`. The inventory is 28 at the floor and 84 at the ceiling, and saying which before the sheets exist would be guessing.'
  }),
  Object.freeze({
    id: 'the-lit-element-is-the-pupil', about: 'eyes',
    question: 'A robot eye is a lamp, a pixel block, a heart. MASC-10B established that an eye set bringing no `gaze` and no `eyelids` is refused by the install, because swapping it in takes the pupils off the face. So what plays the pupil on a lamp, and what does `eyeOpen` do to one?',
    proposal: 'The lit element **is** the pupil: `lookX`/`lookY` move the light inside its housing, which is exactly what a robot eye does when it looks at you, and the dark bezel is the socket that clips it. `eyeOpen` closes the housing — a shutter, or the light going out. The heart and star variants are the `eyes.animal-happy` case: they hold the roles and claim nothing, because a heart does not look anywhere.'
  }),
  Object.freeze({
    id: 'shell-has-no-jaw', about: 'shells',
    question: 'Every head the library ships carries a `jaw` part: the same outline drawn twice, at rest and with its chin stretched down by `jawOpen`. A bolted metal plate does not stretch.',
    proposal: 'A robot shell ships no `jaw` part at all, and `jawOpen` simply moves nothing on a robot face. Check on the shells sheet that a head with no jaw installs and leaves a rig the validator accepts — nothing in the contract requires one, but no shipped head has ever left it out.'
  }),
  Object.freeze({
    id: 'a-robot-names-no-nose', about: 'shells',
    question: 'The planche has no nose row, and the `robot` morphology offers no nose slot. `validateFacePreset` already accepts a preset that names no nose; one test convention (`face-presets.test.js`) asserts every shipped preset names one.',
    proposal: 'Relax that assertion the way MASC-10B relaxed it for `hair`: ask it of the presets that have a nose, and ask the robots for their antenna and their panels instead. No code change beyond the test.'
  }),
  Object.freeze({
    id: 'a-visor-is-two-brows', about: 'visors',
    question: 'The industrial visor is drawn as one heavy piece spanning both eyes. The `eyebrows` category requires `leftBrow` and `rightBrow`, two elements, so that they can raise and tilt independently.',
    proposal: 'Draw it as two halves that meet at the middle, as the mirrored pairs already are. A visor that raises as one piece is then a visor whose two halves happen to move together, which is what `browRaise` does anyway.'
  }),
  Object.freeze({
    id: 'panels-sit-on-the-shell', about: 'panels',
    question: 'A panel is drawn on the shell, at `head.center` — the same anchor the shell itself uses. It has to paint *over* the shell, where the muzzle had to paint under the features.',
    proposal: 'Nothing to do, and worth writing down for that reason: an accessory installed with nothing before it lands last in the group, which is on top. The muzzle\'s problem inverted. Confirm on the panels sheet and move on.'
  }),
  Object.freeze({
    id: 'stripe-belongs-to-panels', about: 'panels',
    question: 'The yellow-and-black hazard stripe appears twice on the planche: as a third variant of the industrial shell, and as the first variant of the industrial panels.',
    proposal: 'It is a panel. A shell is the bare skull in this library and every marking on it is its own piece — the same rule that makes an animal head a bare fur silhouette. Drawn once, in `panels-warning-stripe`, and the shell keeps the two variants that are really shells.'
  }),
  Object.freeze({
    id: 'antenna-and-hat-share-an-anchor', about: 'antennae',
    question: '`head.top` is where MASC-09 proposed the antenna go, and it is also where `accessory.hat` sits. A robot in a hat with an antenna through it is either funny or broken.',
    proposal: 'Check it on the antennae sheet. Both are accessories at one anchor, which the library already handles — the two earrings do it — so the question is graphical, not structural.'
  }),
  Object.freeze({
    id: 'turn-profiles', about: 'antennae',
    question: 'An accessory that says nothing about the 2.5D turn does not turn at all. The antennae stand off the crown, the panels lie flat on the shell, and the side modules project sideways where a person\'s ears are rather than on top where an animal\'s are.',
    proposal: 'An antenna is far from the face and sweeps: a high depth, as the animal ears took. A panel is flush with the shell: near zero, which is what "flat against the head" means. The side modules may take the category default, as the three shipped ear pairs do. Written when the drawings exist, never before.'
  }),
  Object.freeze({
    id: 'the-shipped-robot-preset', about: 'shells',
    question: 'A preset called `robot` already ships: a soft square head, small ears, a bow tie. `presetMorphology` reads it as `human`, correctly — it is a person styled as a robot, with neither an antenna nor a panel on it. Four real robots are about to arrive beside it.',
    proposal: 'Leave the preset and its id alone: it is in saved projects. The four here are `robot-screen`, `robot-retro`, `robot-industrial` and `robot-toy`, so nothing collides. Whether the old one is renamed in the UI is a product call, not this pilot\'s.'
  }),
  Object.freeze({
    id: 'robot-default-preset', about: 'shells',
    question: '`FACE_MORPHOLOGIES.robot.defaultPreset` is null, because no robot preset existed when MASC-01 wrote the table. The same is still true of `muzzle`, whose presets MASC-10B has since drawn.',
    proposal: 'MASC-11B sets robot\'s to `robot-screen`, and fixes muzzle\'s to `cat` while it is in the file. MASC-01\'s test holds every named default to being a real preset, so neither can be written before the presets are.'
  })
]);

/* ── Reading the manifest ─────────────────────────────────────────────── */

const byId = new Map(PILOT_ASSETS.map((item) => [item.id, item]));

/**
 * The planned drawings, narrowed.
 * @param {{ group?, slot?, type?, status?, axis? }} [query]
 */
export function pilotAssets({ group = null, slot = null, type = null, status = null, axis = null } = {}) {
  return PILOT_ASSETS.filter((item) => (!group || item.reviewGroup === group)
    && (!slot || item.slot === slot)
    && (!type || item.types.includes(type))
    && (!status || item.status === status)
    && (!axis || item.variantAxis === axis))
    .slice().sort((a, b) => a.reviewOrder - b.reviewOrder);
}

/** One planned drawing, or null. */
export const pilotAsset = (id) => byId.get(String(id ?? '')) || null;

/** The planned drawings for one visual slot. */
export const pilotAssetsForSlot = (slot) => pilotAssets({ slot });

/** The planned drawings one kind of robot needs. */
export const pilotAssetsForType = (type) => pilotAssets({ type });

/** One recipe, or null. */
export const pilotPreset = (id) => PILOT_PRESETS.find((item) => item.id === String(id ?? '')) || null;

/** What an existing drawing is worth to the pilot, or null for one nobody looked at. */
export const pilotReuse = (id) => PILOT_REUSE.find((item) => item.id === String(id ?? '')) || null;

/** Every id a recipe names. */
export const presetAssetIds = (preset) => [...Object.values(preset?.parts || {}), ...(preset?.accessories || [])];

/**
 * What a recipe puts on a face, row by row — including the two rows that are
 * accessories, which is how the library already carries a face wearing several
 * pieces at one anchor.
 *
 * @returns {Record<string, string|null>} row → asset id
 */
export function presetCoverage(id) {
  const preset = pilotPreset(id);
  if (!preset) return null;
  return {
    ...preset.parts,
    antenna: preset.accessories.find((assetId) => pilotAsset(assetId)?.slot === 'antenna') || null,
    panels: preset.accessories.find((assetId) => pilotAsset(assetId)?.slot === 'panels') || null,
    // Read off the eyes, and null for nothing: a robot has no nose and no hair,
    // and answering null says that rather than leaving the caller to guess.
    nose: null, hair: null
  };
}

/**
 * How many drawings the pilot is actually worth, floor and ceiling.
 *
 * The floor is one drawing per labelled family. The ceiling is the planche's
 * own 84 cells. Which of the two it lands on is decided row by row on the
 * review sheets, and `variantAxis` is the current reading.
 */
export const pilotDrawingRange = () => ({
  families: PILOT_ASSETS.length,
  cells: PILOT_ASSETS.reduce((total, item) => total + item.variants, 0),
  floor: PILOT_ASSETS.length,
  ceiling: PILOT_ASSETS.reduce((total, item) => total + (item.variantAxis === 'colour' ? 1 : item.variants), 0)
});

/** The pilot in one line, for the report and for a test to hold it to. */
export const pilotSummary = () => ({
  families: PILOT_ASSETS.length,
  ...pilotDrawingRange(),
  types: PILOT_TYPES.length,
  presets: PILOT_PRESETS.length,
  palettes: Object.keys(PILOT_PALETTES).length,
  blocking: PILOT_OPEN_QUESTIONS.filter((item) => item.blocking).length,
  drawn: PILOT_ASSETS.filter((item) => item.status === 'candidate').length,
  groups: Object.fromEntries(PILOT_REVIEW_GROUPS.map((group) => [group, pilotAssets({ group }).length]))
});
