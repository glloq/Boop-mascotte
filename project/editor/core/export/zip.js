/**
 * The smallest ZIP this project needs, written and read here rather than
 * depended on.
 *
 * A `.boop` is a container (docs/V4_ROADMAP.md, Phase 4), and the container
 * ought to be one anybody can open: a ZIP can be renamed and unpacked by any
 * operating system, which means a mascot is never hostage to this editor
 * still existing. The alternative -- a format of our own -- is a file nobody
 * else can read, and that is a bad thing to hand someone.
 *
 * Deliberately partial. It writes and reads the one shape it writes: no
 * folders as entries, no encryption, no zip64, no multi-disk. What it does
 * support is the two storage methods that matter -- `deflate-raw` for text,
 * which the platform provides, and stored for pictures, which are compressed
 * already and only get bigger for the trying.
 */

const SIGNATURE = { local: 0x04034b50, central: 0x02014b50, end: 0x06054b50 };
export const STORED = 0;
export const DEFLATED = 8;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const concat = (parts) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
};

const through = async (bytes, stream) => {
  const response = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
};

/** Compression when the platform has it, and honesty when it does not. */
const deflate = async (bytes) => (typeof CompressionStream === 'function' ? through(bytes, new CompressionStream('deflate-raw')) : null);
const inflate = async (bytes) => {
  if (typeof DecompressionStream !== 'function') throw new Error('This file is compressed and this browser cannot read it.');
  return through(bytes, new DecompressionStream('deflate-raw'));
};

const utf8 = (text) => new TextEncoder().encode(text);

/**
 * Entries in, a ZIP out.
 *
 * `compress` is per entry and defaults to on. A picture is already compressed
 * and passing it through deflate spends time to make it very slightly larger,
 * so the package writer says no for those and yes for the JSON beside them.
 *
 * @param {{name: string, bytes: Uint8Array, compress?: boolean}[]} entries
 * @returns {Promise<Uint8Array>}
 */
export async function writeZip(entries = []) {
  const locals = [], central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = utf8(entry.name);
    const raw = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes);
    const packed = entry.compress === false ? null : await deflate(raw);
    // Only when it actually helped: a deflate that grew the data is stored.
    const useDeflate = packed && packed.length < raw.length;
    const body = useDeflate ? packed : raw;
    const method = useDeflate ? DEFLATED : STORED;
    const sum = crc32(raw);

    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, SIGNATURE.local, true);
    view.setUint16(4, 20, true);            // version needed
    view.setUint16(6, 0x0800, true);        // flags: names are UTF-8
    view.setUint16(8, method, true);
    view.setUint32(14, sum, true);
    view.setUint32(18, body.length, true);
    view.setUint32(22, raw.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    locals.push(local, body);

    const record = new Uint8Array(46 + name.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, SIGNATURE.central, true);
    recordView.setUint16(4, 20, true);
    recordView.setUint16(6, 20, true);
    recordView.setUint16(8, 0x0800, true);
    recordView.setUint16(10, method, true);
    recordView.setUint32(16, sum, true);
    recordView.setUint32(20, body.length, true);
    recordView.setUint32(24, raw.length, true);
    recordView.setUint16(28, name.length, true);
    recordView.setUint32(42, offset, true);
    record.set(name, 46);
    central.push(record);

    offset += local.length + body.length;
  }

  const directory = concat(central);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, SIGNATURE.end, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, directory.length, true);
  endView.setUint32(16, offset, true);
  return concat([...locals, directory, end]);
}

/**
 * A ZIP in, its entries out -- read through the central directory, which is
 * the only part of a ZIP that is authoritative about what is in it.
 *
 * Every entry's CRC is checked. A file that arrived over a network or off a
 * failing disk with one byte changed is a mascot that will draw wrong in a way
 * nobody traces back to the file, so it is refused here instead.
 *
 * @returns {Promise<Map<string, Uint8Array>>}
 */
export async function readZip(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input ?? []);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end record is last, after a comment that may be up to 64 KiB.
  let end = -1;
  for (let at = bytes.length - 22; at >= 0 && at >= bytes.length - 22 - 0xffff; at -= 1) {
    if (view.getUint32(at, true) === SIGNATURE.end) { end = at; break; }
  }
  if (end < 0) throw new Error('This is not a readable package: its directory is missing.');

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries = new Map();
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(at, true) !== SIGNATURE.central) throw new Error('This package’s directory is damaged.');
    const method = view.getUint16(at + 10, true);
    const sum = view.getUint32(at + 16, true);
    const packedLength = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const start = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));

    if (view.getUint32(start, true) !== SIGNATURE.local) throw new Error(`${name} is not where the package says it is.`);
    const localNameLength = view.getUint16(start + 26, true);
    const localExtraLength = view.getUint16(start + 28, true);
    const bodyAt = start + 30 + localNameLength + localExtraLength;
    const body = bytes.subarray(bodyAt, bodyAt + packedLength);
    const raw = method === DEFLATED ? await inflate(body) : body.slice();
    if (crc32(raw) !== sum) throw new Error(`${name} is damaged: its checksum does not match.`);
    entries.set(name, raw);

    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
