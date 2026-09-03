/**
 * Authoring helpers for keyform records.
 *
 * Every function is pure and returns a new record, so the undo history can keep
 * storing snapshots and a cancelled capture restores the exact previous state
 * (docs/HEAD_POSE_2_5D.md).  Cells are addressed by grid index, never by
 * parameter value.
 */
import {
  normalizeKeyform, normalizeAxis, keyformChannelNeutral
} from '../../../runtime/keyforms.js';

/** Channels whose value flips sign when a pose grid is mirrored horizontally. */
export const HORIZONTAL_MIRROR_SIGN = Object.freeze({
  translateX: -1, translateY: 1, rotation: -1, scaleX: 1, scaleY: 1, opacity: 1, pathShape: 1
});

export function createKeyform({ id, targetId, channel = 'translateX', axes = [], extrapolation = 'clamp', shapeKey = null } = {}) {
  return normalizeKeyform({
    id, target: { kind: 'element', id: targetId }, channel, shapeKey,
    axes: axes.map(normalizeAxis), keyforms: [], extrapolation
  });
}

export function keyformSize(keyform) {
  return {
    width: keyform?.axes?.[0]?.values.length ?? 0,
    height: keyform?.axes?.[1]?.values.length ?? (keyform?.axes?.length ? 1 : 0)
  };
}

export function keyformCellKey(keyform, i, j = 0) {
  return keyform?.axes?.length > 1 ? `${i}|${j}` : `${i}|0`;
}

export function getKeyformCell(keyform, i, j = 0) {
  const entry = (keyform?.keyforms || []).find((cell) => cell.at[0] === i && (cell.at[1] ?? 0) === j);
  return entry ? entry.value : null;
}

export function hasKeyformCell(keyform, i, j = 0) {
  return getKeyformCell(keyform, i, j) !== null;
}

export function setKeyformCell(keyform, i, j, value) {
  const at = keyform?.axes?.length > 1 ? [i, j] : [i];
  const kept = (keyform?.keyforms || []).filter((cell) => !(cell.at[0] === i && (cell.at[1] ?? 0) === (keyform?.axes?.length > 1 ? j : 0)));
  return normalizeKeyform({ ...keyform, keyforms: [...kept, { at, value }] });
}

export function clearKeyformCell(keyform, i, j = 0) {
  const target = keyform?.axes?.length > 1 ? j : 0;
  return normalizeKeyform({
    ...keyform,
    keyforms: (keyform?.keyforms || []).filter((cell) => !(cell.at[0] === i && (cell.at[1] ?? 0) === target))
  });
}

export function clearKeyformCells(keyform) {
  return normalizeKeyform({ ...keyform, keyforms: [] });
}

/**
 * Cell state for the pose grid UI: `captured` when a sample exists and differs
 * from the channel neutral, `neutral` when it exists and equals it, and
 * `empty` when nothing was ever captured there.
 */
export function keyformCellState(keyform, i, j = 0) {
  const value = getKeyformCell(keyform, i, j);
  if (value === null) return 'empty';
  return value === keyformChannelNeutral(keyform?.channel) ? 'neutral' : 'captured';
}

/** Every cell of the grid, in row-major order, for rendering. */
export function keyformCells(keyform) {
  const { width, height } = keyformSize(keyform);
  const cells = [];
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      cells.push({ i, j, value: getKeyformCell(keyform, i, j), state: keyformCellState(keyform, i, j) });
    }
  }
  return cells;
}

export function copyKeyformCell(keyform, i, j = 0) {
  const value = getKeyformCell(keyform, i, j);
  return value === null ? null : { channel: keyform.channel, value };
}

export function pasteKeyformCell(keyform, i, j, clipboard) {
  if (!clipboard || !Number.isFinite(Number(clipboard.value))) return keyform;
  return setKeyformCell(keyform, i, j, Number(clipboard.value));
}

/**
 * Index whose axis value is the negation of `values[i]`, so an asymmetric axis
 * such as `[-1, -0.4, 0, 0.7, 1]` mirrors onto the samples it actually has.
 * Falls back to the reversed index when no opposite sample exists.
 */
export function mirrorAxisIndex(values, i) {
  const target = -values[i];
  const exact = values.findIndex((value) => Math.abs(value - target) < 1e-9);
  return exact >= 0 ? exact : values.length - 1 - i;
}

/**
 * Mirror a pose grid across its X axis. Cells swap columns and channels that
 * are direction-dependent (`translateX`, `rotation`) flip sign, so a captured
 * "look left" becomes a correct "look right".
 */
export function mirrorKeyformHorizontal(keyform) {
  const values = keyform?.axes?.[0]?.values || [];
  if (!values.length) return keyform;
  const sign = HORIZONTAL_MIRROR_SIGN[keyform.channel] ?? 1;
  const mirrored = (keyform.keyforms || []).map((cell) => ({
    at: cell.at.length > 1 ? [mirrorAxisIndex(values, cell.at[0]), cell.at[1]] : [mirrorAxisIndex(values, cell.at[0])],
    value: cell.value * sign
  }));
  return normalizeKeyform({ ...keyform, keyforms: mirrored });
}

/** Replace an axis definition, dropping captures that fall outside the new one. */
export function setKeyformAxis(keyform, index, axis) {
  const axes = [...(keyform?.axes || [])];
  axes[index] = normalizeAxis(axis);
  return normalizeKeyform({ ...keyform, axes });
}
