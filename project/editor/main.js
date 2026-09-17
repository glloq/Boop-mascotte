/**
 * The editor's entry point, and nothing else (VNX-02, docs/VNEXT_ROADMAP.md).
 *
 * Everything this file used to hold lives in `app/`.
 */
import { createEditorApp } from './app/editor-app.js';
import { openRecoveryStorage } from './core/state/recovery-storage.js';

/**
 * The draft store is opened before the editor, because the editor needs to
 * know at once whether there is a draft to offer, and IndexedDB is
 * asynchronous while the autosave service is not
 * (core/state/recovery-storage.js). It falls back to `localStorage` on its
 * own, and gives up waiting rather than leaving the page blank.
 *
 * `then` rather than top-level await: the build targets browsers that predate
 * it (`vite.config.js`), and an entry point is the one file that cannot need a
 * newer one.
 */
openRecoveryStorage().then((recoveryStorage) => createEditorApp({ recoveryStorage }).mount());
