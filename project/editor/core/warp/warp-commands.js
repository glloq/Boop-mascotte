/**
 * Atomic V2 commands for warp grids (docs/WARP_GRID.md).
 *
 * A warp needs a rest outline to bend, so adding one captures the element's
 * current path as its rest in the same undo step: a warp with nothing to bend
 * would be a trap.
 */
import { normalizeWarp, createWarpGrid, normalizeWarpSize, canParsePath } from '../../../runtime/runtime.js';

const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'warp';

export function createWarpCommands(store, history) {
  const run = (type, domains, operation) => {
    const draft = structuredClone(store.getDocument());
    if (operation(draft) === false) return false;
    history?.snapshot();
    store.execute({ type, source: 'warp', domains, apply: (document) => { document.warps = draft.warps; document.elements = draft.elements; } });
    return true;
  };
  const uniqueId = (document, base) => {
    const used = new Set((document.warps || []).map((item) => item.id));
    let id = slug(base), index = 2;
    while (used.has(id)) id = `${slug(base)}-${index++}`;
    return id;
  };

  return {
    /**
     * @param {string} elementId
     * @param {{ size?: number, box?: object, restPath?: string }} options
     *        `box` is the element's bounding box and `restPath` its current
     *        outline; the caller reads both from the canvas.
     */
    add(elementId, { size = 3, box, restPath } = {}) {
      return run('warp/add', ['keyforms', 'artwork'], (document) => {
        const element = document.elements?.[elementId];
        if (!element) return false;
        const rest = restPath ?? element.restPath;
        if (!canParsePath(rest)) return false;
        if (!(Number(box?.width) > 0) || !(Number(box?.height) > 0)) return false;
        if ((document.warps || []).some((warp) => warp.target === elementId)) return false;
        element.restPath = rest;
        const grid = createWarpGrid(box, { columns: normalizeWarpSize(size), rows: normalizeWarpSize(size) });
        document.warps = [...(document.warps || []), normalizeWarp({ id: uniqueId(document, `${elementId}-warp`), target: elementId, grid })];
      });
    },
    remove(id) {
      return run('warp/remove', ['keyforms'], (document) => {
        const next = (document.warps || []).filter((warp) => warp.id !== id);
        if (next.length === (document.warps || []).length) return false;
        document.warps = next;
      });
    },
    /** Move one control point. The rest lattice never moves. */
    movePoint(id, index, point) {
      return run('warp/move-point', ['keyforms'], (document) => {
        const warp = (document.warps || []).find((item) => item.id === id);
        if (!warp || !warp.grid.points[index]) return false;
        const points = warp.grid.points.map((current, position) => position === index
          ? { x: Number(point.x), y: Number(point.y) } : current);
        warp.grid = normalizeWarp({ ...warp, grid: { ...warp.grid, points } }).grid;
      });
    },
    /** Retune the grid. Control points go back to rest: the old ones no longer fit. */
    setSize(id, size) {
      return run('warp/set-size', ['keyforms'], (document) => {
        const warp = (document.warps || []).find((item) => item.id === id);
        if (!warp) return false;
        const next = normalizeWarpSize(size);
        if (next === warp.grid.columns && next === warp.grid.rows) return false;
        warp.grid = normalizeWarp({ ...warp, grid: { box: warp.grid.box, columns: next, rows: next } }).grid;
      });
    },
    reset(id) {
      return run('warp/reset', ['keyforms'], (document) => {
        const warp = (document.warps || []).find((item) => item.id === id);
        if (!warp) return false;
        warp.grid = normalizeWarp({ ...warp, grid: { box: warp.grid.box, columns: warp.grid.columns, rows: warp.grid.rows } }).grid;
      });
    },
    setDriver(id, driver) {
      return run('warp/set-driver', ['keyforms'], (document) => {
        const warp = (document.warps || []).find((item) => item.id === id);
        if (!warp) return false;
        warp.driver = driver?.parameter ? { parameter: String(driver.parameter), min: Number(driver.min ?? 0), max: Number(driver.max ?? 1) } : null;
      });
    }
  };
}
