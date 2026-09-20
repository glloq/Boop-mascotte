// Basic movements checklist: the ten semantic controls a beginner enables and
// calibrates visually in Face Setup. Derived from ProjectDocument only; the
// authored truth stays in `semanticParts[*].controls / controlDrivers /
// calibration` and the generated bindings.
import { SEMANTIC_PART_REGISTRY, requiredSemanticRoles } from './part-registry.js';
import { findFacePartByType } from './face-roles.js';

/**
 * Every position of the face, in the order the panel shows them.
 *
 * It was the ten a beginner starts with, and a mascot has more than ten
 * positions: the nose scrunches, the jaw drops on its own, the hair moves, the
 * ears wiggle, and an open mouth has teeth and a tongue in it. A part with a
 * movement missing from here has no pose chips and no live slider, which is
 * the same as not being controllable at all.
 */
/**
 * The five bands the panel shows movements in (UIR-08,
 * docs/UIR_REFACTOR_BASELINE.md).
 *
 * Named for what an author is trying to make the face *do*, which is not the
 * same as which part of the rig carries it: looking is something eyes do, and
 * it is carried by the pupils; a jaw drop and a tongue curl are both mouth
 * business and neither is one of the four an author reaches for first.
 *
 * `group` stays the part, because the pose chips and the live sliders are per
 * part and always were. A band is how they are *shown*.
 */
export const MOVEMENT_BANDS = Object.freeze(['Head', 'Eyes', 'Brows', 'Mouth', 'Extra']);

/**
 * How near the front a movement belongs (UX-50 PR 2, docs/UX50_ROADMAP.md).
 *
 * ```text
 * quick   what somebody means when they say "make the mouth move"
 * more    real, wanted less often, and folded until it is asked for
 * ```
 *
 * The panel used to show all twenty-six of these at once, whatever was
 * selected, which made *Tongue curl* exactly as prominent as *Open / close* and
 * left an author scrolling a column to find the one movement they came for.
 *
 * It is a rank **within a part**, not across the face: `tongueOut` is quick
 * because it is the first thing anybody does to a tongue, and it is nobody's
 * idea of a headline movement of the face. That is the band's job, not this one.
 *
 * Deliberately a field on the one movement table rather than a second table
 * beside it: two lists of twenty-six ids drift, and the one that drifts is
 * always the one nobody is looking at.
 */
export const MOVEMENT_TIERS = Object.freeze(['quick', 'more']);

/** A movement's rank, defaulting to `more` so an untagged one folds rather than shouts. */
export const movementTier = (entry) => (MOVEMENT_TIERS.includes(entry?.tier) ? entry.tier : 'more');

export const BASIC_MOVEMENTS = Object.freeze([
  Object.freeze({ id: 'headX', tier: 'quick', band: 'Head', part: 'head', label: 'Move left / right', group: 'Head', axis: 'x', pair: 'headY' }),
  Object.freeze({ id: 'headY', tier: 'quick', band: 'Head', part: 'head', label: 'Move up / down', group: 'Head', axis: 'y', pair: 'headX' }),
  Object.freeze({ id: 'headTilt', tier: 'quick', band: 'Head', part: 'head', label: 'Tilt', group: 'Head', axis: 'x' }),
  // The lids are what actually shuts an eye, and they are a part of their own
  // carrying the same `eyeOpen`. One row covers both (`also`), or switching
  // the movement off would leave the face blinking with its own control gone.
  Object.freeze({ id: 'eyeOpen', tier: 'quick', band: 'Eyes', part: 'eyes', also: Object.freeze(['eyelids']), label: 'Open / close', group: 'Eyes', axis: 'y' }),
  // The two axes an eyelid has that `eyeOpen` cannot carry
  // (docs/FACE_SVG_STATES.md). A narrowed eye is not a half-shut one, and a
  // shut eye that arcs upwards is not the shut eye that lies flat. They are
  // the *lids'* -- the lid is what draws the eye's line -- and they are filed
  // under Eyes because that is the part of the face an author is posing.
  Object.freeze({ id: 'eyeSquint', tier: 'more', band: 'Eyes', part: 'eyelids', label: 'Narrow', group: 'Eyes', axis: 'y' }),
  Object.freeze({ id: 'eyeCurve', tier: 'more', band: 'Eyes', part: 'eyelids', label: 'Lid curve', group: 'Eyes', axis: 'y' }),
  Object.freeze({ id: 'lookX', tier: 'quick', band: 'Eyes', part: 'gaze', label: 'Look left / right', group: 'Gaze', axis: 'x', pair: 'lookY' }),
  Object.freeze({ id: 'lookY', tier: 'quick', band: 'Eyes', part: 'gaze', label: 'Look up / down', group: 'Gaze', axis: 'y', pair: 'lookX' }),
  // The pupils dilate. It is one movement writing two scale axes, which is why
  // the registry lets a binding name a pair (docs/FACE_CONTROL_RIG.md).
  Object.freeze({ id: 'pupilScale', tier: 'more', band: 'Eyes', part: 'gaze', label: 'Pupil size', group: 'Gaze', axis: 'y' }),
  Object.freeze({ id: 'browRaise', tier: 'quick', band: 'Brows', part: 'eyebrows', label: 'Raise', group: 'Eyebrows', axis: 'y' }),
  Object.freeze({ id: 'browTilt', tier: 'quick', band: 'Brows', part: 'eyebrows', label: 'Tilt', group: 'Eyebrows', axis: 'x' }),
  Object.freeze({ id: 'noseScrunch', tier: 'quick', band: 'Extra', part: 'nose', label: 'Scrunch', group: 'Nose', axis: 'y' }),
  Object.freeze({ id: 'mouthOpen', tier: 'quick', band: 'Mouth', part: 'mouth', label: 'Open / close', group: 'Mouth', axis: 'y' }),
  Object.freeze({ id: 'smile', tier: 'quick', band: 'Mouth', part: 'mouth', label: 'Smile', group: 'Mouth', axis: 'y' }),
  Object.freeze({ id: 'mouthWidth', tier: 'quick', band: 'Mouth', part: 'mouth', label: 'Width', group: 'Mouth', axis: 'x' }),
  // How far the lips pucker, which is the difference between AE and OO and is
  // not how wide or how open the mouth is (docs/VISEME_SYSTEM.md).
  Object.freeze({ id: 'mouthRound', tier: 'quick', band: 'Mouth', part: 'mouth', label: 'Round', group: 'Mouth', axis: 'x' }),
  // The smirk: one corner up, the other down, and the lip line leaning after
  // them. `more` rather than `quick`, because a mouth that is not straight is
  // a character choice rather than one of the four a face is posed by.
  Object.freeze({ id: 'mouthSkew', tier: 'more', band: 'Mouth', part: 'mouth', label: 'Lean', group: 'Mouth', axis: 'x' }),
  Object.freeze({ id: 'teeth', tier: 'more', band: 'Mouth', part: 'mouth', label: 'Teeth', group: 'Mouth', axis: 'y' }),
  Object.freeze({ id: 'tongue', tier: 'more', band: 'Mouth', part: 'mouth', label: 'Tongue', group: 'Mouth', axis: 'y' }),
  // A beard is carried by the jaw that opens under it, on the same control.
  Object.freeze({ id: 'jawOpen', tier: 'quick', band: 'Extra', part: 'jaw', also: Object.freeze(['facialHair']), label: 'Drop', group: 'Jaw', axis: 'y' }),
  // Where the tongue is, as opposed to whether it shows (docs/FACE_CONTROL_RIG.md).
  Object.freeze({ id: 'tongueX', tier: 'more', band: 'Extra', part: 'tongue', label: 'Left / right', group: 'Tongue', axis: 'x', pair: 'tongueY' }),
  Object.freeze({ id: 'tongueY', tier: 'more', band: 'Extra', part: 'tongue', label: 'Up / down', group: 'Tongue', axis: 'y', pair: 'tongueX' }),
  Object.freeze({ id: 'tongueOut', tier: 'quick', band: 'Extra', part: 'tongue', label: 'Stick out', group: 'Tongue', axis: 'y' }),
  Object.freeze({ id: 'tongueCurl', tier: 'more', band: 'Extra', part: 'tongue', label: 'Curl', group: 'Tongue', axis: 'x' }),
  Object.freeze({ id: 'hairSway', tier: 'quick', band: 'Extra', part: 'hair', label: 'Sway', group: 'Hair', axis: 'x' }),
  Object.freeze({ id: 'hairLift', tier: 'quick', band: 'Extra', part: 'hair', label: 'Lift', group: 'Hair', axis: 'y' }),
  Object.freeze({ id: 'earWiggle', tier: 'quick', band: 'Extra', part: 'ears', label: 'Wiggle', group: 'Ears', axis: 'x' })
]);

export const movementEntry = (id) => BASIC_MOVEMENTS.find((entry) => entry.id === id) || null;

const MORPH_POSES = { eyeOpen: [{ key: 'closed', label: 'Closed', value: 0 }, { key: 'open', label: 'Open', value: 1 }] };
const DEFAULT_MORPH_POSES = [{ key: 'neutral', label: 'Neutral', value: 0 }, { key: 'open', label: 'Open', value: 1 }];

/**
 * Pose cards for one control: registry poses for transforms, the endpoint pair
 * for morphs, and none at all for shape keys — the shapes *are* the
 * calibration, and there is nothing to capture from the canvas.
 */
export function calibrationPoses(partType, control, driver) {
  if (driver?.method === 'shapeKey') return [];
  if (driver?.method === 'morph') return MORPH_POSES[control] || DEFAULT_MORPH_POSES;
  return SEMANTIC_PART_REGISTRY[partType]?.calibration?.[control]?.poses || [];
}

/**
 * Who a movement moves, for a sentence written about it -- "pose **the eyes**",
 * "assign **the jaw** first".
 *
 * One table, read by the pose instructions and by the checklist rows alike.
 * The panel used to keep a second copy of it that knew five parts of ten, so a
 * Nose, Jaw, Tongue, Hair or Ears row asked the author to "assign the artwork"
 * without saying which.
 */
const SUBJECTS = Object.freeze({ head: 'the head', eyes: 'the eyes', eyelids: 'the eyelids', gaze: 'the pupils', eyebrows: 'the eyebrows', nose: 'the nose', mouth: 'the mouth', jaw: 'the jaw', tongue: 'the tongue', hair: 'the hair', ears: 'the ears', facialHair: 'the facial hair' });
export const movementSubject = (part) => SUBJECTS[part] || 'the artwork';

/**
 * A band, in the words a sentence can be written about it (UX-50 PR 2).
 *
 * "Showing the extra" is not a sentence anybody wrote on purpose. The bands are
 * named for the column heading they sit under, which is the right word there
 * and the wrong word in prose, so prose gets its own.
 */
const BAND_SUBJECTS = Object.freeze({ Head: 'the head', Eyes: 'the eyes', Brows: 'the eyebrows', Mouth: 'the mouth', Extra: 'the rest of the face' });
export const bandSubject = (band) => BAND_SUBJECTS[band] || 'this part of the face';

/**
 * The captures one movement asks for, in the order an author is asked for them.
 *
 * The registry lists a control's poses along its own axis -- LEFT, CENTER,
 * RIGHT -- which is the order the solver reads them in, not the order they are
 * authored in. Setting a movement up starts from where it **rests**, because
 * that is the face already drawn and the one capture that changes nothing, and
 * then asks for each end the movement has to reach (VNX-15).
 *
 * Wording and order only. `calibrateSemanticPart` still solves the movement
 * from the samples; nothing here computes how far anything moves.
 */
export function calibrationSteps(partType, control, driver, parameter) {
  const poses = calibrationPoses(partType, control, driver);
  if (!poses.length) return [];
  // Rest is the pose sitting at the parameter's own default: an eye rests OPEN
  // and a mouth rests CLOSED, and each of those is that parameter's default.
  const home = Number(parameter?.default ?? SEMANTIC_PART_REGISTRY[partType]?.parameters?.[control]?.default ?? 0);
  const rest = poses.find((pose) => Number(pose.value) === home) || null;
  const shape = driver?.method === 'morph';
  return [rest, ...poses.filter((pose) => pose !== rest)].filter(Boolean).map((pose, index) => ({
    ...pose,
    rest: pose === rest,
    step: index + 1,
    title: pose === rest ? 'Resting position' : `Full ${String(pose.label).toLowerCase()}`,
    // One short line: it is read while doing the step, and the canvas banner
    // names the artwork again the moment the pose session opens.
    hint: pose === rest
      ? shape ? 'The shape it rests in.' : 'Leave it as drawn.'
      : shape ? 'Move the nodes, then capture.' : 'As far as it should go.'
  }));
}

/** Human, direction-aware instruction for capturing one pose. */
export function poseInstruction(entry, pose) {
  const subject = movementSubject(entry.part);
  // The resting capture is the one where nothing moves: telling an author to
  // move artwork that is already in position reads like a step they failed.
  if (pose.rest ?? (pose.value === 0 && pose.key !== 'open' && pose.key !== 'closed')) return `Leave ${subject} at rest, then press Capture.`;
  return `Move ${subject} to the ${pose.label.toLowerCase()} position, then press Capture.`;
}

/**
 * Whether a movement already moves the artwork, and by what.
 *
 * Turning a movement on writes generated bindings with a default range, the
 * template arrives with tuned ones, and the head's own turn is a posed grid:
 * every one of those moves the face the moment it exists. "Not set up yet" on
 * a row whose artwork visibly moves read as a step the author had failed;
 * what the positions actually do is *tune* how far it goes.
 *
 * @returns {'bindings'|'headPose'|'morph'|'shapeKey'|null}
 */
export function movementMoves(document, part, control, driver) {
  if (!part || !driver) return null;
  const owned = (record) => record?.generatedBy?.semanticPart === part.id && record?.generatedBy?.control === control;
  // A shaped movement moves by its keys. Asking the *method* instead was the
  // one case where a row could say "ready" about a movement with nothing
  // behind it: enabling Teeth by hand writes the method and no keys, and the
  // panel called that calibrated because the template -- which authors its own
  // keys -- always had some.
  if (driver.method === 'shapeKey') {
    return (document?.shapeKeys || []).some((key) => owned(key)) ? 'shapeKey' : null;
  }
  if (driver.method === 'morph') {
    return Object.values(document?.elements || {}).some((element) => element?.morph?.enabled && owned(element.morph)) ? 'morph' : null;
  }
  if (part.type === 'head' && (control === 'headX' || control === 'headY')) {
    const posed = (document?.keyforms || []).some((item) => String(item?.id || '').startsWith('headPose:') && (item.keyforms || []).length);
    if (posed) return 'headPose';
  }
  const bound = (driver.roles || []).some((role) => {
    const element = document?.elements?.[part.roles?.[role]];
    return Object.values(element?.bindings || {}).some((binding) => binding && binding.enabled !== false && owned(binding) && Number(binding.amplitude) !== 0);
  });
  return bound ? 'bindings' : null;
}

export function deriveMovementChecklist(document) {
  const items = BASIC_MOVEMENTS.map((entry) => {
    const part = findFacePartByType(document, entry.part), definition = SEMANTIC_PART_REGISTRY[entry.part];
    // Every part this one row switches: the named one, and any part sharing
    // the control (`also`). A row is a movement of the face, not of one part,
    // so it has to reach all of them or "off" is a lie about the ones it missed.
    const shared = (entry.also || []).map((type) => findFacePartByType(document, type)).filter(Boolean);
    const partIds = [part, ...shared].filter(Boolean).map((item) => item.id);
    // Required roles only: a mouth is ready to move without the optional
    // cavity, which is artwork the turn carries rather than a movement.
    const rolesReady = Boolean(part && requiredSemanticRoles(definition).every((role) => part.roles?.[role] && document?.elements?.[part.roles[role]]));
    const enabled = Boolean(part?.controls?.includes(entry.id)) || shared.some((item) => item.controls?.includes(entry.id));
    const driver = part?.controlDrivers?.[entry.id] || null;
    const poses = enabled ? calibrationPoses(entry.part, entry.id, driver) : calibrationPoses(entry.part, entry.id, null);
    const record = part?.calibration?.[entry.id];
    const capturedKeys = driver?.method === 'morph' ? Object.keys(record || {}) : (record?.samples || []).map((sample) => sample.key);
    const poseItems = poses.map((pose) => ({ ...pose, captured: capturedKeys.includes(pose.key) }));
    const captured = poseItems.filter((pose) => pose.captured).length;
    // A shaped movement arrives calibrated *when it has its keys*: they say
    // what it does at both ends, so the panel has nothing to ask for. One that
    // has been switched on and has none is on and not set up, like any other.
    const movingBy = enabled ? movementMoves(document, part, entry.id, driver) : null;
    const status = !part ? 'unassigned' : !rolesReady ? 'incomplete' : !enabled ? 'off'
      : movingBy === 'shapeKey' || captured >= 2 ? 'calibrated' : 'on';
    return { ...entry, partId: part?.id || shared[0]?.id || null, partIds, status, enabled, moving: Boolean(movingBy), movingBy, method: driver?.method || null, property: driver?.property || null, poses: poseItems, captured, total: poseItems.length, parameter: document?.params?.[entry.id] || null };
  });
  const groups = new Map();
  for (const item of items) { if (!groups.has(item.group)) groups.set(item.group, []); groups.get(item.group).push(item); }
  // The same items, filed under what they make the face do, each band holding
  // its parts in the order the registry lists them (UIR-08).
  const bands = new Map(MOVEMENT_BANDS.map((band) => [band, new Map()]));
  for (const item of items) {
    const parts = bands.get(item.band) || bands.get('Extra');
    if (!parts.has(item.group)) parts.set(item.group, []);
    parts.get(item.group).push(item);
  }
  for (const [band, parts] of bands) if (!parts.size) bands.delete(band);
  return {
    items,
    groups,
    bands,
    available: items.filter((item) => item.status !== 'unassigned' && item.status !== 'incomplete').length,
    enabled: items.filter((item) => item.enabled).length,
    calibrated: items.filter((item) => item.status === 'calibrated').length,
    total: items.length
  };
}

/** How far along one set of movement rows is, in the three numbers a heading needs. */
const tally = (items) => ({
  total: items.length,
  available: items.filter((item) => item.status !== 'unassigned' && item.status !== 'incomplete').length,
  enabled: items.filter((item) => item.enabled).length,
  calibrated: items.filter((item) => item.status === 'calibrated').length
});

/**
 * The five families of movement, with how ready each one is (UX-50 PR 2).
 *
 * What the panel shows when **nothing** is selected. The alternative — showing
 * every movement because none has been ruled out — is the inventory this slice
 * is removing, and it is worst precisely when the author has not yet said what
 * they are working on.
 *
 * A family with no movement in this project at all is left out rather than
 * shown empty: a heading that can never have anything under it is a heading
 * that wasted a line.
 */
export function movementFamilies(checklist) {
  return MOVEMENT_BANDS
    .map((band) => ({ band, ...tally((checklist?.items || []).filter((item) => item.band === band)) }))
    .filter((family) => family.total);
}

/**
 * The movements this screen should show, given what is in hand (UX-50 PR 2).
 *
 * `band` narrows to one family — the one the selection belongs to — and
 * `showAll` puts the whole inventory back. Nothing is *removed* by narrowing:
 * `hidden` is how many rows the filter is holding back, which is what the
 * `Show all controls` button has to say for itself. Progressive disclosure that
 * cannot tell you what it disclosed is just hiding.
 *
 * Pure, and shaped exactly like `deriveMovementChecklist().bands`, so the panel
 * renders one thing either way.
 */
export function contextualMovements(checklist, { band = null, showAll = false } = {}) {
  const all = checklist?.bands || new Map();
  const focused = !showAll && band && MOVEMENT_BANDS.includes(band) && all.has(band) ? band : null;
  // Three states, and the third is the one §10 asks for by name: with nothing
  // selected the panel offers the **families** and their readiness rather than
  // every movement the project has. An inventory shown because nothing has
  // been ruled out is the inventory this slice removes, and it is worst
  // exactly when the author has not yet said what they are working on.
  const scope = focused ? 'band' : showAll ? 'all' : 'families';
  const bands = scope === 'families' ? new Map() : focused ? new Map([[focused, all.get(focused)]]) : new Map(all);
  const shown = [...bands.values()].reduce((sum, parts) => sum + [...parts.values()].reduce((count, items) => count + items.length, 0), 0);
  return {
    scope,
    band: focused,
    bands,
    shown,
    hidden: Math.max(0, (checklist?.items || []).length - shown),
    families: movementFamilies(checklist)
  };
}

/** One group's rows, split by how near the front they belong. */
export const byTier = (items = []) => ({
  quick: items.filter((item) => movementTier(item) === 'quick'),
  more: items.filter((item) => movementTier(item) !== 'quick')
});
