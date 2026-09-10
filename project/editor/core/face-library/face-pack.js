/**
 * Face packs (docs/FACE_PART_LIBRARY.md, "Face packs"; roadmap phase 44).
 *
 * A pack is one JSON document of parts and presets -- from another machine,
 * from someone else, from a module that ships faces -- taken into the
 * library as the author's own. It is all or nothing: every part and every
 * preset is validated against the library *and the pack itself* (a preset
 * may name a part of the same pack) before anything is registered, so a
 * pack with one bad asset changes nothing. What comes in carries the pack's
 * id (`pack`), so a card can say where it came from, and is kept with the
 * author's own parts and presets, so it is there after a reload.
 *
 * ```json
 * { "format": "boop-face-pack", "version": 1, "id": "grins", "name": "Grins",
 *   "parts":   [ { "id": "mouth.grin", "category": "mouth", "name": "Grin", "artwork": "<g id=\"mouth-grin\">…</g>", "roles": { "mouth": "…" }, … } ],
 *   "presets": [ { "id": "grinning", "name": "Grinning", "parts": { "mouth": "mouth.grin" }, "palette": "warm" } ] }
 * ```
 *
 * The artwork of a pack's part goes through the same validation as any
 * asset (no script, no handler, no external reference) and, when it goes on
 * a face, through the same sanitizer as every drawing the editor takes.
 */
import { FACE_PART_LIBRARY, saveCustomParts } from './face-part-registry.js';
import { FACE_PRESET_LIBRARY, saveCustomPresets, validateFacePreset } from './face-presets.js';
import { validateFacePart } from './face-part-validation.js';

export const FACE_PACK_FORMAT = 'boop-face-pack';
export const FACE_PACK_VERSION = 1;
const PACK_ID = /^[a-z0-9][a-z0-9-]*$/;

/** @returns {{ format: string, version: number, id: string, name: string, description: string, parts: object[], presets: object[] }} */
export function normalizeFacePack(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const list = (value) => Object.freeze(Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []);
  return Object.freeze({
    format: typeof source.format === 'string' ? source.format.trim() : '',
    // Left out, the version is this one; written, it is read as it is, so "2.0.0" is not quietly version 1.
    version: source.version === undefined || source.version === null || source.version === '' ? FACE_PACK_VERSION : Number(source.version),
    id: typeof source.id === 'string' ? source.id.trim() : '',
    name: typeof source.name === 'string' ? source.name.trim() : '',
    description: typeof source.description === 'string' ? source.description.trim() : '',
    parts: list(source.parts),
    presets: list(source.presets)
  });
}

/** The library with the pack's own parts over it: what the pack's presets are checked against. */
const overlay = (library, staged) => ({
  get: (id) => staged.get(id) || library.get(id),
  has: (id) => staged.has(id) || library.has(id),
  list: (category = null) => [...library.list(category), ...[...staged.values()].filter((asset) => !category || asset.category === category)]
});

/**
 * Every part and every preset checked, against the library and the pack
 * itself; the issues say which entry (`parts[2].id`, `presets[0].parts.mouth`).
 *
 * @returns {{ ok: boolean, pack: object, parts: object[], presets: object[], issues: object[], errors: object[] }}
 */
export function validateFacePack(input, { library = FACE_PART_LIBRARY, presets = FACE_PRESET_LIBRARY } = {}) {
  const pack = normalizeFacePack(input);
  const issues = [];
  const error = (code, message, field) => issues.push({ severity: 'error', code, message, field });
  if (pack.format !== FACE_PACK_FORMAT) error('pack-format', `Not a face pack: the file says ${pack.format ? `"${pack.format}"` : 'nothing'} where "${FACE_PACK_FORMAT}" was expected.`, 'format');
  if (!Number.isInteger(pack.version) || pack.version < 1 || pack.version > FACE_PACK_VERSION) error('pack-version', `This pack says version ${Number.isNaN(pack.version) ? 'something that is not a number' : pack.version}; this editor reads packs of version 1 to ${FACE_PACK_VERSION}.`, 'version');
  if (!pack.id) error('pack-id-missing', 'A pack needs an id, like "grins".', 'id');
  else if (!PACK_ID.test(pack.id)) error('pack-id-format', `"${pack.id}" is not a valid pack id: lower-case letters, digits and dashes.`, 'id');
  if (!pack.name) error('pack-name-missing', 'A pack needs a name.', 'name');
  if (!pack.parts.length && !pack.presets.length) error('pack-empty', 'A pack holds at least one part or one preset.', 'parts');

  // An id is taken by the library, or by an earlier entry of the pack -- a refused one too, so a duplicate is named as such.
  const staged = new Map();
  const partIds = new Set();
  const parts = [];
  pack.parts.forEach((item, index) => {
    const result = validateFacePart({ ...item, origin: 'custom', pack: pack.id }, { taken: (id) => library.has(id) || partIds.has(id) });
    for (const issue of result.issues) issues.push({ ...issue, field: `parts[${index}]${issue.field ? `.${issue.field}` : ''}` });
    if (result.asset.id) partIds.add(result.asset.id);
    if (result.ok) { staged.set(result.asset.id, result.asset); parts.push(result.asset); }
  });
  const view = overlay(library, staged);
  const presetIds = new Set();
  const list = [];
  pack.presets.forEach((item, index) => {
    const result = validateFacePreset({ ...item, origin: 'custom', pack: pack.id }, view, { taken: (id) => presets.has(id) || presetIds.has(id) });
    for (const issue of result.issues) issues.push({ severity: 'error', ...issue, field: `presets[${index}]${issue.field ? `.${issue.field}` : ''}` });
    if (result.preset.id) presetIds.add(result.preset.id);
    if (result.ok) list.push(result.preset);
  });
  const errors = issues.filter((issue) => issue.severity === 'error');
  return { ok: errors.length === 0, pack, parts, presets: list, issues, errors };
}

/**
 * The pack into the library and the presets, all or nothing, and into
 * storage when one is given (the author's own parts and presets).
 *
 * @returns {{ ok: true, pack: { id: string, name: string, description: string }, parts: string[], presets: string[] } | { ok: false, pack: object, reason: string, issues: object[] }}
 */
export function installFacePack(input, { library = FACE_PART_LIBRARY, presets = FACE_PRESET_LIBRARY, partStorage = null, presetStorage = null } = {}) {
  const result = validateFacePack(input, { library, presets });
  if (!result.ok) return { ok: false, pack: result.pack, reason: result.errors.map((issue) => issue.message).join(' '), issues: result.issues };
  const registeredParts = [];
  const registeredPresets = [];
  try {
    for (const asset of result.parts) registeredParts.push(library.register(asset));
    for (const item of result.presets) registeredPresets.push(presets.register(item));
  } catch (error) {
    // Validated above, so this is a registry with rules of its own: nothing of the pack stays.
    for (const item of registeredPresets) presets.remove(item.id);
    for (const asset of registeredParts) library.remove(asset.id);
    return { ok: false, pack: result.pack, reason: error.message, issues: error.issues || [] };
  }
  if (partStorage) saveCustomParts(partStorage, library);
  if (presetStorage) saveCustomPresets(presetStorage, presets);
  return { ok: true, pack: { id: result.pack.id, name: result.pack.name, description: result.pack.description }, parts: registeredParts.map((asset) => asset.id), presets: registeredPresets.map((item) => item.id) };
}

/** A pack from a module of one's own, into the editor's library: the same install, nothing kept in storage. */
export const registerFacePack = (pack) => installFacePack(pack);
