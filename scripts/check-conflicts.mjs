import { opendir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ignored = new Set(['node_modules', 'dist', 'playwright-report', 'test-results', '.git']);
const markers = /^(<<<<<<<|=======|>>>>>>>)(?: |$)/;
const findings = [];

async function scan(directory) {
  for await (const entry of await opendir(directory)) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (entry.isFile()) {
      let source;
      try { source = await readFile(path, 'utf8'); } catch { continue; }
      source.split(/\r?\n/).forEach((line, index) => { if (markers.test(line)) findings.push(`${relative(process.cwd(), path)}:${index + 1}: ${line}`); });
    }
  }
}

await scan(process.cwd());
if (findings.length) {
  console.error(`Merge conflict markers detected:\n${findings.join('\n')}`);
  process.exitCode = 1;
} else console.log('No merge conflict markers detected.');
