import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const root=new URL('../../',import.meta.url).pathname;
// `app/e2e-hooks.js` is the opt-in browser-test seam, not authoring code: it
// is absent from normal editor URLs, and it held this same allowance while it
// lived inside main.js (docs/VNEXT_ROADMAP.md, VNX-02).
const allowed=new Set(['core/state/editor-store.js','core/undo/history.js','main.js','app/e2e-hooks.js','core/tests/release-regressions.test.js','core/tests/preview-timeline.test.js']);
function files(dir){return readdirSync(dir).flatMap(name=>{const p=join(dir,name);return statSync(p).isDirectory()?files(p):[p];});}
test('production authoring cannot use flat mutation compatibility APIs',()=>{const offenders=[];for(const file of files(root).filter(x=>x.endsWith('.js'))){const rel=relative(root,file);if(allowed.has(rel)||rel.startsWith('core/tests/'))continue;const source=readFileSync(file,'utf8');if(/store\.(?:setState|replaceState)\s*\(/.test(source))offenders.push(rel);}assert.deepEqual(offenders,[]);});
