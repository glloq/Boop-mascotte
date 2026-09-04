/**
 * The editor's entry point, and nothing else (VNX-02, docs/VNEXT_ROADMAP.md).
 *
 * Everything this file used to hold lives in `app/`.
 */
import { createEditorApp } from './app/editor-app.js';

createEditorApp().mount();
