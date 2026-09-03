/**
 * Parsed path representation.
 *
 * An SVG `d` string is parsed **once** into a fixed command list plus a flat
 * numeric vector. Deformation then works on numbers, and the string is rebuilt
 * only when the numbers actually change (docs/SHAPE_KEYS.md,
 * docs/RUNTIME_PERFORMANCE.md). Parsing a path inside the render loop is the
 * single thing this module exists to prevent.
 *
 * ```text
 * "M0 0 L10 0 Z"  ──parse once──►  { commands: ['M','L','Z'],
 *                                    values:   Float64Array [0,0,10,0],
 *                                    signature: 'M L Z' }
 * ```
 */

/** Argument count per SVG path command. */
export const PATH_ARGUMENTS = Object.freeze({ m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 });

/** Positions inside an arc command that are 0/1 flags, not coordinates. */
const ARC_FLAGS = new Set([3, 4]);

const WHITESPACE = new Set([' ', '\t', '\n', '\r', '\f', ',']);

const parseCache = new Map();
const PARSE_CACHE_LIMIT = 512;

export class PathParseError extends Error {}

/**
 * @param {string} d
 * @returns {{ commands: string[], values: Float64Array, signature: string, source: string }}
 * @throws {PathParseError} on a malformed or unsupported path
 */
export function parsePath(d) {
  const source = String(d ?? '');
  const cached = parseCache.get(source);
  if (cached) return cached;
  const parsed = Object.freeze({ ...scanPath(source), source });
  if (parseCache.size >= PARSE_CACHE_LIMIT) parseCache.delete(parseCache.keys().next().value);
  parseCache.set(source, parsed);
  return parsed;
}

/** Whether a path can be parsed at all — the authoring-time eligibility check. */
export function canParsePath(d) {
  try { parsePath(d); return true; } catch { return false; }
}

/**
 * Command layout, ignoring coordinates. Two paths can only be blended when
 * their signatures match, so this is the compatibility key for shape keys.
 */
export function pathSignature(d) {
  return typeof d === 'string' ? parsePath(d).signature : d?.signature ?? '';
}

export function pathsCompatible(a, b) {
  try { return pathSignature(a) === pathSignature(b); } catch { return false; }
}

/** Rebuild a `d` string from a command list and a numeric vector. */
export function serializePath(commands, values, precision = 4) {
  const parts = [];
  let index = 0;
  for (const command of commands) {
    const arity = PATH_ARGUMENTS[command.toLowerCase()];
    if (!arity) { parts.push(command); continue; }
    const args = [];
    const arc = command === 'a' || command === 'A';
    for (let k = 0; k < arity; k += 1) {
      const value = values[index + k];
      args.push(arc && ARC_FLAGS.has(k) ? String(value ? 1 : 0) : formatNumber(value, precision));
    }
    parts.push(`${command}${args.join(' ')}`);
    index += arity;
  }
  return parts.join(' ');
}

/** Convenience: parse, transform the numbers, serialize. */
export function mapPathValues(d, map) {
  const parsed = parsePath(d);
  const values = Float64Array.from(parsed.values, map);
  return serializePath(parsed.commands, values);
}

export function formatNumber(value, precision = 4) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  const rounded = Math.round(number * 10 ** precision) / 10 ** precision;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/* ── Scanner ─────────────────────────────────────────────────────────────── */

function scanPath(source) {
  let index = 0;
  const commands = [];
  const values = [];

  const skip = () => { while (index < source.length && WHITESPACE.has(source[index])) index += 1; };
  const startsNumber = () => {
    const char = source[index];
    return char === '+' || char === '-' || char === '.' || (char >= '0' && char <= '9');
  };
  const readNumber = () => {
    skip();
    const start = index;
    if (source[index] === '+' || source[index] === '-') index += 1;
    while (index < source.length && source[index] >= '0' && source[index] <= '9') index += 1;
    if (source[index] === '.') { index += 1; while (index < source.length && source[index] >= '0' && source[index] <= '9') index += 1; }
    if (source[index] === 'e' || source[index] === 'E') {
      const mark = index;
      index += 1;
      if (source[index] === '+' || source[index] === '-') index += 1;
      if (source[index] >= '0' && source[index] <= '9') { while (index < source.length && source[index] >= '0' && source[index] <= '9') index += 1; }
      else index = mark;
    }
    const text = source.slice(start, index);
    const number = Number(text);
    if (!text || !Number.isFinite(number)) throw new PathParseError(`Expected a number at position ${start} of the path.`);
    return number;
  };
  // Arc flags may be written without separators ("a1 1 0 011 1"), so they are
  // read one character at a time rather than as ordinary numbers.
  const readFlag = () => {
    skip();
    if (source[index] === '0' || source[index] === '1') { const flag = Number(source[index]); index += 1; return flag; }
    return readNumber() ? 1 : 0;
  };

  let command = null;
  skip();
  while (index < source.length) {
    const char = source[index];
    if (/[A-Za-z]/.test(char)) {
      if (PATH_ARGUMENTS[char.toLowerCase()] === undefined) throw new PathParseError(`Unsupported path command "${char}".`);
      command = char;
      index += 1;
      if (PATH_ARGUMENTS[char.toLowerCase()] === 0) { commands.push(command); skip(); continue; }
    } else if (!command) {
      throw new PathParseError('A path must start with a command.');
    } else if (!startsNumber()) {
      throw new PathParseError(`Unexpected character "${char}" in the path.`);
    }
    const arity = PATH_ARGUMENTS[command.toLowerCase()];
    const arc = command === 'a' || command === 'A';
    for (let k = 0; k < arity; k += 1) values.push(arc && ARC_FLAGS.has(k) ? readFlag() : readNumber());
    commands.push(command);
    // An implicit repeat of "moveto" continues as "lineto", per the SVG spec.
    if (command === 'M') command = 'L'; else if (command === 'm') command = 'l';
    skip();
  }
  if (commands.length === 0) throw new PathParseError('The path is empty.');
  return { commands, values: Float64Array.from(values), signature: commands.join(' ') };
}
