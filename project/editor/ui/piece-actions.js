/**
 * What an author does to one piece of the mascot, wherever they are standing.
 *
 * ```text
 * Design ▸ Face      pick an eye, press Delete            ← was: nothing happened
 * Design ▸ Artwork   pick a path, press Delete            ← the only screen that worked
 * Rig ▸ Assign       right-click a shape, Bring forward   ← the menu, but not the keys
 * ```
 *
 * Every one of these gestures already had an implementation — `canvas.delete`,
 * `canvas.duplicate`, `canvas.reorder`, `canvas.flip`, `canvas.setVisibility`,
 * `canvas.setLocked`, `facePartCommands.remove` — and every one of them was
 * reachable from exactly one surface, because the key handler and the canvas
 * menu each carried their own `workspace === 'create'` test. So the screen
 * built for somebody who does not know what an SVG is had the drawing tools
 * taken away *and* the editing gestures with them.
 *
 * This is the catalogue and the decisions, in one place and pure: which actions
 * a piece offers, what a key press means, whether a delete is big enough to ask
 * about, and what to say afterwards. The wiring that calls a command lives in
 * `app/editor-app.js`, where the commands are; the menu (`ui/canvas-menu.js`)
 * and the on-canvas bar (`ui/selection-actions.js`) read this to know what to
 * draw. Nothing here touches a document or the DOM, which is why
 * `core/tests/piece-actions.test.js` can hold all of it to account.
 */

/**
 * The three tiers, in the order they are offered. The same words
 * `ui/disclosure.js` uses, and for the same reason: `simple` is what somebody
 * reaches for on a first mascot, `more` is the rest of the everyday set, and
 * `advanced` names a rigging concept.
 */
export const ACTION_LEVELS = Object.freeze(['simple', 'more', 'advanced']);

/**
 * Every action, once.
 *
 * `needs` is what the action requires of the piece, checked by
 * {@link pieceActionsFor}:
 *
 * ```text
 * path      an outline with points
 * shape     a primitive that could become one
 * clip      something is cutting it
 * group     a <g>
 * ```
 *
 * No `needs` means any unlocked piece.
 *
 * Two entries left with the Character Builder (V5-07): *Replace…*, which
 * offered the library's other drawings for a part, and *Reset position*, which
 * put a library drawing back where its fit had placed it. Both opened the
 * builder, and neither has anything to act on without it -- a piece of a V5
 * mascot is a file somebody made, and the editor has no other drawing of it to
 * offer.
 *
 * `bar` marks the five that ride on the canvas next to the selection. It was
 * six while *Replace* was among them, and the count is a decision rather than
 * a limit that happened: another button is one more thing to read every time
 * anything is selected, and the menu is one keystroke away.
 */
export const PIECE_ACTIONS = Object.freeze([
  Object.freeze({ id: 'duplicate', label: 'Duplicate', glyph: '⧉', keys: 'Ctrl/Cmd + D', level: 'simple', bar: 1 }),
  Object.freeze({ id: 'flip-x', label: 'Flip horizontally', glyph: '⇋', level: 'simple', bar: 2 }),
  Object.freeze({ id: 'forward', label: 'Bring forward', glyph: '↑', keys: ']', level: 'simple', bar: 3, hint: 'Paint it in front of the next piece' }),
  Object.freeze({ id: 'backward', label: 'Send backward', glyph: '↓', keys: '[', level: 'simple', bar: 4, hint: 'Paint it behind the previous piece' }),
  Object.freeze({ id: 'delete', label: 'Delete', glyph: '🗑', keys: 'Delete', level: 'simple', danger: true, bar: 5 }),

  Object.freeze({ id: 'flip-y', label: 'Flip vertically', glyph: '⇵', level: 'more' }),
  Object.freeze({ id: 'front', label: 'Bring to front', keys: 'Ctrl/Cmd + Shift + ]', level: 'more' }),
  Object.freeze({ id: 'back', label: 'Send to back', keys: 'Ctrl/Cmd + Shift + [', level: 'more' }),
  Object.freeze({ id: 'visibility', label: 'Hide', altLabel: 'Show', glyph: '◐', level: 'more' }),
  Object.freeze({ id: 'lock', label: 'Lock', altLabel: 'Unlock', glyph: '🔒', level: 'more' }),
  Object.freeze({ id: 'isolate', label: 'Isolate', altLabel: 'Stop isolating', glyph: '⊙', level: 'more', hint: 'Dim everything else while you work on it' }),

  // The five that name a rigging concept. They were at the top of the canvas
  // menu, in front of Duplicate, on every screen (UIR-04's complaint about
  // cards applies to menus too): a beginner met "Convert to a path — for
  // points, pins and shape keys" before they met Delete.
  Object.freeze({ id: 'part', label: 'Open its face part', altLabel: 'Assign to a face part', level: 'advanced', hint: 'Rig ▸ Assign' }),
  Object.freeze({ id: 'points', label: 'Edit points', level: 'advanced', needs: 'path', hint: 'Node tool, in Artwork' }),
  Object.freeze({ id: 'pin', label: 'Add a pin here', level: 'advanced', needs: 'path', hint: 'Rig ▸ Deform' }),
  Object.freeze({ id: 'to-path', label: 'Convert to a path', level: 'advanced', needs: 'shape', hint: 'For points, pins and shape keys' }),
  // "comes back" was the only outcome when every cut owned a frozen copy of its
  // shape. A cut written `<use href="#head">` cuts to a drawing that is in the
  // artwork the whole time, so what it *stays* is the true half of both.
  Object.freeze({ id: 'release-clip', label: 'Stop cutting it', level: 'advanced', needs: 'clip', hint: 'The shape that cuts it stays in the drawing' })
]);

export const PIECE_ACTION_IDS = Object.freeze(PIECE_ACTIONS.map((action) => action.id));

export const pieceAction = (id) => PIECE_ACTIONS.find((action) => action.id === id) || null;

/** The six that ride on the canvas, in their own order. */
export const BAR_ACTIONS = Object.freeze(PIECE_ACTIONS.filter((action) => action.bar).sort((a, b) => a.bar - b.bar));

/**
 * The surfaces a gesture reaches, and how much of the catalogue each shows.
 *
 * `create` is the vector editor, so it sees everything including the five
 * rigging entries. `rig` is where artwork is named, so it sees them too.
 * `hands` is where hands are designed, and a hand is handled rather than
 * rigged, so it sees the simple half. `preview` and the studios see nothing —
 * in Preview the canvas is a test bench, and a Delete there would be a trap.
 *
 * `character` was the first of them and the reason this module exists: an
 * editing surface with none of these gestures on it. It is gone with the
 * Character Builder (V5-07), and what it argued for is now true of Artwork,
 * which every author lands on.
 */
export const GESTURE_SURFACES = Object.freeze({
  create: 'advanced',
  rig: 'advanced',
  hands: 'simple'
});

/** Whether a surface takes piece gestures at all. */
export const takesGestures = (surface) => Boolean(GESTURE_SURFACES[String(surface ?? '')]);

/** How deep a surface's menu goes: `simple` hides the rigging entries. */
export const gestureDepth = (surface) => GESTURE_SURFACES[String(surface ?? '')] || null;

/** How deep a surface reads before it folds the rest away. */
export const LEVEL_RANK = Object.freeze({ simple: 0, more: 1, advanced: 2 });

/**
 * The actions this piece offers, in catalogue order, each already carrying the
 * label it should show.
 *
 * A piece that is **locked** offers only Unlock: every other action would
 * either be refused by the command or silently move something the author asked
 * the editor to hold still.
 *
 * @param {object} piece
 * @param {boolean} [piece.locked]
 * @param {boolean} [piece.visible]
 * @param {boolean} [piece.isolated]  whether the canvas is already scoped to it
 * @param {boolean} [piece.path]      it is a path
 * @param {boolean} [piece.shape]     it is a primitive that could become one
 * @param {boolean} [piece.clip]      something is cutting it
 * @param {boolean} [piece.part]      a face part already owns it
 * @param {'simple'|'more'|'advanced'} [depth]  how much of the catalogue to offer
 * @returns {{id, label, glyph?, keys?, level, danger?, hint?}[]}
 */
export function pieceActionsFor(piece = {}, depth = 'advanced') {
  const max = LEVEL_RANK[depth] ?? LEVEL_RANK.advanced;
  if (piece.locked) return [{ ...pieceAction('lock'), label: 'Unlock' }];
  return PIECE_ACTIONS.filter((action) => {
    if ((LEVEL_RANK[action.level] ?? 9) > max) return false;
    if (action.needs === 'path') return Boolean(piece.path);
    if (action.needs === 'shape') return Boolean(piece.shape);
    if (action.needs === 'clip') return Boolean(piece.clip);
    if (action.needs === 'group') return Boolean(piece.group);
    return true;
  }).map((action) => {
    // Three actions are toggles, so their label is the state they lead to.
    if (action.id === 'visibility') return { ...action, label: piece.visible === false ? action.altLabel : action.label };
    if (action.id === 'lock') return { ...action, label: action.label };
    if (action.id === 'isolate') return { ...action, label: piece.isolated ? action.altLabel : action.label };
    if (action.id === 'part') return { ...action, label: piece.part ? action.label : action.altLabel };
    return { ...action };
  });
}

const META = (event) => Boolean(event?.ctrlKey || event?.metaKey);
const KEY = (event) => String(event?.key || '').toLowerCase();

/**
 * Which piece action a key press means, or null.
 *
 * Deliberately narrow: this answers for the **selection**, and only once
 * nothing more specific has the keyboard. A path node being edited owns Delete,
 * a pen run owns Enter and Backspace, and a text field owns everything — all
 * three are decided by the caller before it asks, because only the caller knows
 * them. What this owns is the mapping, so that Delete cannot mean one thing in
 * Artwork and nothing at all in Face.
 *
 * @param {KeyboardEvent} event
 * @returns {string|null} an action id
 */
export function matchPieceKey(event) {
  if (!event) return null;
  const key = KEY(event), meta = META(event);
  if (!meta && (event.key === 'Delete' || event.key === 'Backspace')) return 'delete';
  if (meta && !event.shiftKey && key === 'd') return 'duplicate';
  // The two brackets are the depth keys every layer-based editor has, and Boop
  // had no key for depth at all — it had a menu entry on two screens out of six.
  if (meta && event.shiftKey && (event.key === ']' || event.key === '}')) return 'front';
  if (meta && event.shiftKey && (event.key === '[' || event.key === '{')) return 'back';
  if (!meta && event.key === ']') return 'forward';
  if (!meta && event.key === '[') return 'backward';
  return null;
}

/**
 * Whether a delete is big enough to ask about first (§4.3 of the audit).
 *
 * The default is **not to ask**. A delete that one keystroke undoes and that
 * says so in a toast does not need a modal in front of it, and a modal in front
 * of every delete teaches people to dismiss modals — which is how a
 * confirmation that was meant to protect somebody stops protecting anybody.
 *
 * So the question is not "is this a lot?" but **"can the author see what they
 * are about to lose?"**. Three shapes inside a marquee they just drew: yes.
 * The three things below: no.
 *
 * ```text
 * a marquee too big to recount   five or more at once
 * a piece other parts hang on    the badge goes with the hood
 * pieces carrying the rig        two or more movements stop working
 * ```
 *
 * `roles` is counted across the whole selection, not only its first piece:
 * lassoing the eyes and the mouth together is exactly the delete that silently
 * takes four movements with it.
 *
 * @param {{ count?: number, hosted?: number, roles?: number }} what
 * @returns {{ confirm: boolean, question: string, detail: string }}
 */
export const CONFIRM_AT = 5;

export function deleteConfirmation({ count = 1, hosted = 0, roles = 0 } = {}) {
  const no = { confirm: false, question: '', detail: '' };
  if (count >= CONFIRM_AT) {
    return { confirm: true, question: `Delete these ${count} pieces?`, detail: 'They go in one step, and one undo brings them all back.' };
  }
  if (hosted > 0) {
    return {
      confirm: true,
      question: `Delete it, and the ${hosted === 1 ? 'piece' : `${hosted} pieces`} on it?`,
      detail: `${hosted === 1 ? 'Something is' : 'Things are'} hanging on this one, and ${hosted === 1 ? 'it comes' : 'they come'} off with it. One undo puts everything back.`
    };
  }
  if (roles >= 2) {
    return {
      confirm: true,
      question: count > 1 ? `Delete these ${count} pieces, and the ${roles} movements they play?` : `Delete it, and the ${roles} movements it plays?`,
      detail: `The face parts drawn by ${count > 1 ? 'these pieces' : 'this piece'} stop working until something else plays them.`
    };
  }
  return no;
}

/**
 * What the toast says once it is done, and what its one button offers.
 *
 * Every message in the editor that ends "Undo puts it back" is a message that
 * was written for a toast with a button and shipped into one without
 * (`shell/overlays.js` wrote `textContent`). The sentence stops naming the
 * keystroke here, because the button is right there — and on a phone the
 * keystroke does not exist.
 *
 * @param {{ label?: string, count?: number, hosted?: number }} what
 * @returns {{ message: string, action: string }}
 */
export function deleteMessage({ label = 'It', count = 1, hosted = 0 } = {}) {
  if (count > 1) return { message: `${count} pieces deleted.`, action: 'Undo' };
  const guests = hosted ? `, with what hung on it` : '';
  return { message: `${label} deleted${guests}.`, action: 'Undo' };
}

/**
 * The reason an action cannot run, for the one place that has to say it.
 *
 * `room` is the honest answer for depth: "already at the front of its group" is
 * a fact about the drawing, not a failure, and it is the only thing a person
 * can do something about.
 */
export function actionRefusal(id, { locked = false, room = true } = {}) {
  if (locked) return 'This piece is locked. Unlock it first.';
  if (!room && (id === 'forward' || id === 'front')) return 'Already at the front of its group.';
  if (!room && (id === 'backward' || id === 'back')) return 'Already at the back of its group.';
  return '';
}
