/**
 * Arranging several pieces at once (docs/VECTOR_EDITING.md): what a marquee
 * picks, and where Align and Distribute move things. Pure over boxes
 * `{ id, x, y, width, height }` measured in one shared space; the canvas
 * measures, and turns each answer into a move in the piece's own space.
 */
export const ALIGNMENTS = Object.freeze(['left', 'center', 'right', 'top', 'middle', 'bottom']);
export const DISTRIBUTIONS = Object.freeze(['horizontal', 'vertical']);

const finite = (box) => box && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(Number(box[key])));

/** The smallest box around all of them, or null with nothing to measure. */
export function unionBox(boxes) {
  const list = (boxes || []).filter(finite);
  if (!list.length) return null;
  const x = Math.min(...list.map((box) => box.x)), y = Math.min(...list.map((box) => box.y));
  const right = Math.max(...list.map((box) => box.x + box.width)), bottom = Math.max(...list.map((box) => box.y + box.height));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * How far each box moves to line up on one edge or centre line. With two or
 * more boxes the line is the selection's own; `target` lines them up on a
 * given box instead (the working area, say), one box included.
 *
 * @returns {{ id: string, dx: number, dy: number }[]} only the boxes that move
 */
export function alignBoxes(boxes, kind, { target = null } = {}) {
  const list = (boxes || []).filter(finite);
  const frame = target && finite(target) ? target : unionBox(list);
  if (!frame || !ALIGNMENTS.includes(kind) || (!target && list.length < 2)) return [];
  const moves = [];
  for (const box of list) {
    let dx = 0, dy = 0;
    if (kind === 'left') dx = frame.x - box.x;
    if (kind === 'center') dx = frame.x + frame.width / 2 - (box.x + box.width / 2);
    if (kind === 'right') dx = frame.x + frame.width - (box.x + box.width);
    if (kind === 'top') dy = frame.y - box.y;
    if (kind === 'middle') dy = frame.y + frame.height / 2 - (box.y + box.height / 2);
    if (kind === 'bottom') dy = frame.y + frame.height - (box.y + box.height);
    if (Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9) moves.push({ id: box.id, dx, dy });
  }
  return moves;
}

/**
 * Equal gaps between three or more boxes along one axis. The first and the
 * last stay where they are; the ones between them spread out evenly.
 */
export function distributeBoxes(boxes, axis) {
  const list = (boxes || []).filter(finite);
  if (list.length < 3 || !DISTRIBUTIONS.includes(axis)) return [];
  const start = axis === 'horizontal' ? 'x' : 'y', size = axis === 'horizontal' ? 'width' : 'height';
  const ordered = [...list].sort((a, b) => a[start] - b[start] || a[size] - b[size]);
  const first = ordered[0], last = ordered.at(-1);
  const span = last[start] + last[size] - first[start];
  const gap = (span - ordered.reduce((sum, box) => sum + box[size], 0)) / (ordered.length - 1);
  const moves = [];
  let cursor = first[start];
  for (const box of ordered) {
    const delta = cursor - box[start];
    if (Math.abs(delta) > 1e-9) moves.push({ id: box.id, dx: axis === 'horizontal' ? delta : 0, dy: axis === 'horizontal' ? 0 : delta });
    cursor += box[size] + gap;
  }
  return moves;
}

/** Whether `box` lies wholly inside `frame`. */
export const containsBox = (frame, box) => finite(frame) && finite(box)
  && box.x >= frame.x && box.y >= frame.y && box.x + box.width <= frame.x + frame.width && box.y + box.height <= frame.y + frame.height;

/**
 * What a marquee picks: the highest pieces of the tree that lie wholly inside
 * it. A piece inside the marquee is taken whole, children and all; one that
 * only crosses it is looked into, so a marquee around the two eyes of a face
 * picks the eyes and not the face. Touching is not enough, because in nested
 * artwork the root touches everything.
 *
 * @param {{ id: string, children?: object[] }[]} tree  the layer tree
 * @param {{ x, y, width, height }} frame                the marquee, in the box space
 * @param {(item: object) => ({ x, y, width, height }|null)} boxOf
 * @param {(item: object) => boolean} [skip]             locked or hidden pieces
 */
export function marqueeSelection(tree, frame, boxOf, skip = () => false) {
  const picked = [];
  const visit = (items) => {
    for (const item of items || []) {
      if (!item || skip(item)) continue;
      const box = boxOf(item);
      if (box && containsBox(frame, box)) { picked.push(item.id); continue; }
      visit(item.children);
    }
  };
  visit(tree);
  return picked;
}

/** A box from any two corners, whichever way the drag went. */
export function boxFromCorners(a, b) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

/**
 * A screen vector in a piece's own space: the linear part of the inverse of
 * the matrix that maps that space to the screen, with no translation, so a
 * move of `v` on screen becomes the move of a piece inside a rotated or
 * scaled group.
 */
export function vectorInSpace(inverse, vector) {
  if (!inverse) return { x: vector.x, y: vector.y };
  return { x: inverse.a * vector.x + inverse.c * vector.y, y: inverse.b * vector.x + inverse.d * vector.y };
}
