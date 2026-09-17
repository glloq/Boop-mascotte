import test from 'node:test';
import assert from 'node:assert/strict';
import { carriesFiles, createPictureDrop, picturesIn } from '../../app/picture-drop.js';

/** A host with the two things the drop needs: listeners and a class list. */
const host = () => {
  const listeners = new Map(), classes = new Set();
  return {
    listeners, classes,
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), has: (name) => classes.has(name) },
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type) => listeners.delete(type),
    fire: (type, event = {}) => listeners.get(type)?.({ preventDefault() {}, ...event })
  };
};
const fileOf = (name, type = '') => ({ name, type });
const transferOf = (files = [], types = ['Files']) => ({ types, files, dropEffect: '' });

test('only a drag carrying files is claimed',()=>{
  assert.equal(carriesFiles(transferOf()),true);
  // A card from the part library carries its own type and is left to the
  // handler that knows about it.
  assert.equal(carriesFiles({ types: ['application/x-boop-part'] }),false);
  // And so is anything else: intercepting a link or a piece of text and then
  // refusing it takes away the browser's own behaviour for no gain.
  assert.equal(carriesFiles({ types: ['text/plain', 'text/uri-list'] }),false);
  assert.equal(carriesFiles(null),false);
});

test('a picture is recognised by what it is, and by its name where the browser said nothing',()=>{
  const { pictures, rejected } = picturesIn(transferOf([
    fileOf('head.webp', 'image/webp'), fileOf('eye.png', 'image/png'),
    fileOf('badge.svg', ''), fileOf('notes.txt', 'text/plain'), fileOf('photo.jpg', 'image/jpeg')
  ]));
  assert.deepEqual(pictures.map((file) => file.name),['head.webp','eye.png','badge.svg']);
  assert.equal(rejected,2);
});

test('pictures land in the order they were dropped, one at a time',async()=>{
  const element = host(), imported = [];
  createPictureDrop(element, { onPicture: async (file) => { await Promise.resolve(); imported.push(file.name); } });
  await element.fire('drop', { dataTransfer: transferOf([fileOf('a.png', 'image/png'), fileOf('b.webp', 'image/webp'), fileOf('c.svg', 'image/svg+xml')]) });
  // Awaited one after another, so three dropped together are three undo steps
  // in the order somebody dropped them rather than whichever finished first.
  assert.deepEqual(imported,['a.png','b.webp','c.svg']);
});

test('the canvas says it will take the drop, and stops saying so',async()=>{
  const element = host();
  createPictureDrop(element, { onPicture: async () => {} });
  element.fire('dragenter', { dataTransfer: transferOf([fileOf('a.png', 'image/png')]) });
  assert.ok(element.classes.has('picture-drop-over'));
  // Entering a child fires enter again before the parent's leave; counting is
  // what stops the hint flickering off while the cursor is still over it.
  element.fire('dragenter', { dataTransfer: transferOf([fileOf('a.png', 'image/png')]) });
  element.fire('dragleave', { dataTransfer: transferOf([fileOf('a.png', 'image/png')]) });
  assert.ok(element.classes.has('picture-drop-over'),'still over the canvas');
  element.fire('dragleave', { dataTransfer: transferOf([fileOf('a.png', 'image/png')]) });
  assert.equal(element.classes.has('picture-drop-over'),false);

  // A drop clears it too, however many enters came first.
  element.fire('dragenter', { dataTransfer: transferOf([fileOf('a.png', 'image/png')]) });
  await element.fire('drop', { dataTransfer: transferOf([fileOf('a.png', 'image/png')]) });
  assert.equal(element.classes.has('picture-drop-over'),false);
});

test('the drop has to be allowed, or the browser refuses it',()=>{
  const element = host(); let prevented = 0;
  createPictureDrop(element, { onPicture: async () => {} });
  const event = { dataTransfer: transferOf([fileOf('a.png', 'image/png')]), preventDefault: () => { prevented += 1; } };
  element.fire('dragover', event);
  // Without this the browser opens the file instead of letting it be dropped.
  assert.equal(prevented,1);
  assert.equal(event.dataTransfer.dropEffect,'copy');
});

test('nothing is dropped onto a project that is not there',async()=>{
  const element = host(), imported = [];
  createPictureDrop(element, { isReady: () => false, onPicture: async (file) => imported.push(file.name) });
  await element.fire('drop', { dataTransfer: transferOf([fileOf('a.png', 'image/png')]) });
  assert.deepEqual(imported,[]);
  assert.equal(element.classes.has('picture-drop-over'),false);
});

test('a drop of nothing usable is one sentence, not twelve refusals',async()=>{
  const element = host(), said = [];
  createPictureDrop(element, { onPicture: async () => {}, setStatus: (message, tone) => said.push([message, tone]) });
  await element.fire('drop', { dataTransfer: transferOf([fileOf('a.txt', 'text/plain')]) });
  assert.match(said[0][0],/That file is not a picture/);
  assert.equal(said[0][1],'error');

  await element.fire('drop', { dataTransfer: transferOf([fileOf('a.txt', 'text/plain'), fileOf('b.doc', 'application/msword')]) });
  assert.match(said[1][0],/None of those 2 files/);

  // Some good, some not: the good ones land and the rest are accounted for.
  const imported = [];
  const mixed = host();
  const told = [];
  createPictureDrop(mixed, { onPicture: async (file) => imported.push(file.name), setStatus: (message, tone) => told.push([message, tone]) });
  await mixed.fire('drop', { dataTransfer: transferOf([fileOf('a.png', 'image/png'), fileOf('b.txt', 'text/plain')]) });
  assert.deepEqual(imported,['a.png']);
  assert.match(told[0][0],/1 of those files was not a picture/);
  assert.equal(told[0][1],'warn');
});

test('it lets go of the canvas when told to',()=>{
  const element = host();
  const stop = createPictureDrop(element, { onPicture: async () => {} });
  assert.equal(element.listeners.size,4);
  stop();
  assert.equal(element.listeners.size,0);
});
