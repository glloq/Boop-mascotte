/**
 * Authoring the handles on the mascot (docs/DIRECT_CONTROLS.md).
 *
 * Every command writes one sparse override into `document.rigHandles` and
 * nothing else: what an author did not change keeps coming from the generated
 * set, so a default that improves later still reaches this project. Removing
 * an override is therefore the same thing as "reset to generated".
 *
 * Atomic, like every other command boundary here: one `history.snapshot()`,
 * one `store.execute` over the `rigHandles` domain.
 */
import { RIG_HANDLE_COLOURS, RIG_HANDLE_CONTROLLERS, RIG_HANDLE_SHAPES, RIG_HANDLE_SIZES, RIG_HANDLE_SPOTS, normalizeRigHandle } from './handle-record.js';
import { toggleRigLink } from './control-links.js';

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export function createHandleCommands(store, history) {
  const run = (type, apply, { snapshot = true } = {}) => {
    if (snapshot) history?.snapshot();
    return store.execute({ type, domains: ['rigHandles'], source: 'handles', apply });
  };

  /** Change one handle's override in place, creating it if this is the first change. */
  const patch = (id, type, change, options = {}) => run(type, (document) => {
    const list = Array.isArray(document.rigHandles) ? document.rigHandles : [];
    const index = list.findIndex((item) => item.id === id);
    const next = change({ ...(index > -1 ? structuredClone(list[index]) : { id }) });
    const record = next && normalizeRigHandle(next);
    document.rigHandles = index > -1
      ? (record ? list.map((item, position) => (position === index ? record : item)) : list.filter((_, position) => position !== index))
      : (record ? [...list, record] : list);
  }, options);

  return {
    rename: (id, name) => patch(id, 'handles/rename', (handle) => ({ ...handle, name: String(name || '').trim() || undefined })),
    setHint: (id, hint) => patch(id, 'handles/hint', (handle) => ({ ...handle, hint: String(hint || '').trim() || undefined })),
    /** Where on its artwork it sits, and how far off that spot. */
    place: (id, { at, offset } = {}) => patch(id, 'handles/place', (handle) => ({
      ...handle,
      at: RIG_HANDLE_SPOTS.includes(at) ? at : handle.at,
      offset: offset ? { x: number(offset.x), y: number(offset.y) } : handle.offset
    })),
    /** Nudge it, in the artwork's own units — what a drag in Edit handles writes. */
    move: (id, dx, dy) => patch(id, 'handles/move', (handle) => ({
      ...handle,
      offset: { x: number(handle.offset?.x) + number(dx), y: number(handle.offset?.y) + number(dy) }
    })),
    /**
     * Narrow, lock or snap one axis.
     *
     * A limit is what a rig has and a poser does not: this mouth never opens
     * past 0.7, and no gesture can take it there.
     */
    setAxis: (id, axis, patchAxis) => patch(id, 'handles/axis', (handle) => {
      const axes = { ...(handle.axes || {}) };
      const current = { ...(axes[axis] || {}) };
      for (const [key, value] of Object.entries(patchAxis || {})) {
        if (value === null || value === undefined) delete current[key];
        else current[key] = key === 'locked' || key === 'invert' ? Boolean(value) : key === 'parameter' ? String(value) : number(value);
      }
      if (Object.keys(current).length) axes[axis] = current; else delete axes[axis];
      return { ...handle, axes: Object.keys(axes).length ? axes : undefined };
    }),
    setWidget: (id, widget) => patch(id, 'handles/widget', (handle) => ({
      ...handle,
      widget: {
        ...(handle.widget || {}),
        ...(RIG_HANDLE_SHAPES.includes(widget?.shape) ? { shape: widget.shape } : {}),
        ...(RIG_HANDLE_SIZES.includes(widget?.size) ? { size: widget.size } : {}),
        ...(RIG_HANDLE_COLOURS.includes(widget?.colour) ? { colour: widget.colour } : {}),
        // Which control the handle offers (VNX-14). Derived unless an author
        // says otherwise, like every other field of the widget.
        ...(RIG_HANDLE_CONTROLLERS.includes(widget?.controller) ? { controller: widget.controller } : {})
      }
    })),
    setGroup: (id, group) => patch(id, 'handles/group', (handle) => ({ ...handle, group: group || undefined })),
    setLayer: (id, layer) => patch(id, 'handles/layer', (handle) => ({ ...handle, layer: String(layer || '').trim() || undefined })),
    /** Switch a generated handle off without losing it: an override, not a deletion. */
    hide: (id, hidden = true) => patch(id, 'handles/hide', (handle) => ({ ...handle, hidden: hidden ? true : undefined })),
    /** Back to whatever the generated set says, by forgetting the override. */
    reset: (id) => patch(id, 'handles/reset', () => null),

    /**
     * A handle of an author's own: its own artwork, its own parameters.
     *
     * This is the point of the record — a control the registry knows nothing
     * about, on a mascot the registry has never seen.
     */
    create(id, { elements = [], x = null, y = null, name = '', at = 'centre', layer = 'custom' } = {}) {
      const document = store.getDocument();
      const clean = elements.filter((item) => document.elements?.[item]);
      if (!clean.length) return { ok: false, reason: 'no-artwork', message: 'Choose the artwork this control sits on.' };
      if (!document.params?.[x] && !document.params?.[y]) return { ok: false, reason: 'no-movement', message: 'Choose at least one movement for it to drive.' };
      if ((document.rigHandles || []).some((item) => item.id === id)) return { ok: false, reason: 'exists', message: 'A control with that name already exists.' };
      patch(id, 'handles/create', (handle) => ({
        ...handle, authored: true, name: name || id, elements: clean, at, layer,
        axes: { ...(x ? { x: { parameter: x } } : {}), ...(y ? { y: { parameter: y } } : {}) }
      }));
      return { ok: true, id };
    },
    /** Only an authored handle can be removed; a generated one is hidden instead. */
    remove: (id) => patch(id, 'handles/remove', () => null),

    /**
     * Move the two sides of a control together, or apart (CR-10).
     *
     * A link writes no parameter and changes no rig: it decides which of two
     * parameters a per-side control writes, so an author can link, pose,
     * unlink and pose again without the runtime learning that any of it
     * happened (docs/FACE_CONTROL_RIG.md).
     */
    setLink: (id, linked) => run('handles/link', (document) => {
      document.rigLinks = toggleRigLink(document, id, linked);
    })
  };
}

/** A readable id from a name an author typed, unique against what is there. */
export function handleIdFrom(name, taken = []) {
  const base = String(name || 'control').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'control';
  if (!taken.includes(base)) return base;
  for (let index = 2; index < 99; index += 1) if (!taken.includes(`${base}-${index}`)) return `${base}-${index}`;
  return `${base}-${Date.now()}`;
}
