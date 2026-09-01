# PR 37 initial failure matrix

Audited base: `6fdcad0a9394d6c3d36e96d8da9e780c3d25784b`.

The requested GitHub run artifacts (`33526288922` and `33526288900`) could not be
downloaded in this environment because neither the GitHub CLI nor the GitHub API had
credentials/access (CLI reported no authenticated host; the API tunnel returned HTTP
403). Before any product edits, the failing contracts were nevertheless confirmed
against the exact audited-base test sources and current UI markup. The matrix therefore
records the published run status from the task and the exact stale selectors/assertions
present at that SHA; it does not invent unavailable trace details.

| Test | Browser | Selector / action / assertion | Actual | Expected by test | Root cause | Classification |
| --- | --- | --- | --- | --- | --- | --- |
| `sample, preview and project download work` | Chromium, Firefox, WebKit | `getByText(/Layers \\(\\d+\\)/)` immediately after Basic Face | Layers is inside the closed Create → Artwork disclosure | Layers text immediately visible | The test retained the former always-visible Layers contract instead of using `openArtwork(page)` | **STALE TEST** |
| `Build a Face generates an honest valid project that previews and saves` | Chromium | Problems panel `toContainText('Mascot ready')` | Current panel says `Project check` and `✓ No problems found` | Decorative legacy phrase `Mascot ready` | The test coupled readiness to removed marketing copy rather than a semantic status | **STALE TEST** |
| `deployed editor previews and exports the user project` | Pages Chromium | `#rig-panel button[data-part]` | The Rig navigator exposes Semantic Parts via `[data-semantic-part-id]`; no obsolete `data-part` button exists | A visible legacy Part button | Pages smoke bypassed the canonical Semantic Parts navigation/helper | **STALE TEST** |

## Initial CI supplied for this audit

- Verify: **GREEN**
- Chromium critical: **RED**
- Firefox/WebKit cross-browser smoke: **RED**
- Pages build: **GREEN**
- Pages deploy: **GREEN**
- Pages smoke: **RED**

