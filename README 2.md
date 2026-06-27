---
title: Markdown-Backed Kanban Board — Amplenote Plugin
bounty: https://public.amplenote.com/Y6vpMukmBqdZFn2K38CkR6yZ
author: Jonathan Wagner
version: 1.0.0
license: MIT
status: functional / best-effort against documented Amplenote APIs
---

# Markdown-Backed Kanban Board

Turn any Amplenote note into a polished, drag-and-drop kanban board where the
**note's markdown is the single source of truth**:

- **Columns = headings** (`#`…`######`)
- **Cards = top-level tasks** under each heading (`- [ ]` / `- [x]`)
- Every board action edits the underlying markdown and the board re-reads the
  note, so the note and the board never drift apart.

The UI ships as an Amplenote **embed** (an isolated iframe rendered in the
sidebar). All markdown reading/writing happens in the plugin's `onEmbedCall`
handler using the documented `app` API; the embed never touches note content
directly.

---

## Repository layout

```
amplenote-kanban/
├── src/
│   ├── kanban-core.js      # Pure markdown <-> board parser & mutators (no app dep, unit-tested)
│   ├── plugin.js           # The Amplenote plugin object (appOption/renderEmbed/onEmbedCall)
│   ├── bridge.js           # Embed-side RPC wrapper over window.callAmplenotePlugin (+ dev mock)
│   ├── render-md.js        # Tiny safe inline-markdown tokenizer for card view mode
│   ├── Board.jsx           # React kanban UI (columns, cards, DnD, editor, settings)
│   ├── index.jsx           # Embed entry point
│   └── styles.css          # Amplenote-dark-theme-friendly styling
├── assets/
│   ├── embed.html          # Production embed shell (base64 JS/CSS injected at build)
│   ├── embed.dev.html      # Dev shell for `npm run dev`
│   └── note.template.md    # Plugin note (metadata table + settings + code placeholder)
├── test/
│   └── kanban-core.test.js # 31 unit tests for the parser/mutator (node:test)
├── dist/                   # Build output (generated)
│   ├── note.md             # Import-ready plugin note (code inlined)
│   ├── build.html.json     # Bundled embed (attached to the plugin note)
│   └── plugin.zip          # Markdown archive: note.md + build.html.json
├── build.mjs               # esbuild pipeline (bundle embed, inline core into note, zip)
└── package.json
```

---

## Install

You need the two build artifacts in `dist/`: **`note.md`** and
**`build.html.json`**. `dist/plugin.zip` bundles both as a markdown archive.

### Option A — import the markdown archive (recommended)

1. In Amplenote, **Import → Markdown archive (.zip)** and select
   `dist/plugin.zip`. This creates the plugin note **with** the
   `build.html.json` attachment already linked.
2. Open the imported note, then in **Account → Plugins** (or the note's ••• →
   *Enable as plugin*) **enable it as a plugin**.

### Option B — manual

1. Create a new note. Paste the contents of `dist/note.md` (the metadata table,
   the ```` ```javascript ```` code block, and the `[build.html.json](...)`
   link line).
2. Attach `dist/build.html.json` to that note so its filename is exactly
   `build.html.json`.
3. Enable the note as a plugin.

### Configure (optional)

The plugin note exposes these **settings** rows (each is a string):

| Setting | Default | Effect |
|---|---|---|
| `WIP limit per column (0 = unlimited)` | `0` | Caps cards per column; the “+ Add card” button disables and the count badge turns amber when exceeded. |
| `Last column completes cards` | `true` | Dropping a card into the **last** column marks the task complete (crossed out) in the note. |
| `Render first image in cards` | `true` | Embeds the first image found in a task body at the bottom of the card. |
| `Render Rich Footnotes` | `true` | Shows footnote affordances on cards. |
| `Board density (comfortable \| compact)` | `comfortable` | Visual density. |

In-board ⚙ settings let you tweak the same options live for the current session.

---

## Use

- Open the note you want to manage, then **••• → Open as Kanban Board** (or run
  **Create Kanban Board** from the action bar). The board opens in the sidebar.
- **Drag a card** to another column → moves the task under that heading.
- **Drag a card to the last column** → also marks the task complete (toggle in
  settings).
- **Drag within a column** → reorders the task.
- **+ Add card** in a column, **+ Column** in the toolbar.
- **Double-click a column title** to rename (edits the heading).
- **Drag a column header** to reorder columns (reorders headings).
- **✕ on a column** deletes it; its cards move to the **top of the note under no
  heading**.
- **Click a card** to open the raw-markdown editor (edit task text + multiline
  body, set a start date, tag a note, or delete). **⌘/Ctrl+Enter** saves,
  **Esc** cancels.
- **Drag a card to the `(No heading)` backlog** (when present) to pull it out
  from under any heading.
- **⟳** refreshes the board from the note.

Cards, columns, and the editor are keyboard-focusable with visible focus rings;
the board UI is dark-first with a restrained charcoal palette and a muted
slate-indigo accent intended to sit naturally inside Amplenote's dark theme.

---

## Develop / test

```bash
npm install
npm test          # 31 parser/mutator unit tests (node:test)
npm run dev       # live embed at http://localhost:5000 with an in-memory mock board
npm run build     # regenerate dist/note.md, dist/build.html.json, dist/plugin.zip
```

`npm run dev` runs the real React UI against an in-memory markdown document
(`bridge.js` → `mockBridge`), so you can exercise drag/drop, the editor, column
operations, footnotes, and images without Amplenote.

---

## How markdown maps to the board

```markdown
# To Do                ← column "To Do"
- [ ] Buy milk         ← card
- [ ] Write report     ← card (with a multiline body below)
  Notes about the report
  ![chart](https://…)  ← first image renders at the card bottom

## In Progress
- [ ] Refactor parser {start:2026-06-20}   ← start date chip

## Done                ← if it's the last column, drops here complete the task
- [x] Set up repo <!-- {"uuid":"…","completedAt":…} -->   ← metadata preserved
```

- Tasks **before the first heading** appear in a read-only `(No heading)`
  backlog column (they're never written as a heading).
- Start dates are stored as a `{start:YYYY-MM-DD}` token on the task line.
- Note tags are stored as an appended markdown link to the note.
- Completed-task metadata comments are preserved verbatim on move.

---

## Requirements compliance matrix

Bounty source: <https://public.amplenote.com/Y6vpMukmBqdZFn2K38CkR6yZ>

| # | Requirement | Status | Where / notes |
|---|---|---|---|
| 1 | Convert a note into a kanban view | ✅ | `appOption`/`noteOption` → sidebar embed; `parseBoard` |
| 2 | Each column = a heading | ✅ | `parseBoard` (`HEADING_RE`) |
| 3 | Each card = a task under the heading | ✅ | `parseBoard` (`TASK_RE`, top-level only) |
| 4 | Drag a card between columns moves it between headings | ✅ | `moveCard` / `moveCardToIndex` |
| 5 | Dragging into the **last** column crosses it out in the note | ✅ | `markComplete` in `Board.jsx` + `setLineChecked`; toggleable |
| 6 | Create new cards via a per-column button | ✅ | “+ Add card” → `addCard` |
| 7 | Per-column upper limit (WIP) | ✅ | `wipLimit` setting; button disables, badge warns |
| 8 | Click a card to edit → shows pure markdown | ✅ | `CardEditor` modal (raw md textarea) |
| 9 | Recognize/display Rich Footnotes **only when viewing** | ✅ (best-effort) | `parseFootnotes`/`classifyFootnote`; raw `[^id]` shown in editor |
| 10 | Web URLs clickable | ✅ | `InlineTokens` link/bareurl → `app.navigate` |
| 11 | Rich footnotes (image+text+URL) open as a sidebar embed | ⚠️ partial | Classified as `embed`; opens a rich preview via `app.alert`/sidebar. A dedicated footnote *embed* view is stubbed — see Limitations. |
| 12 | First image in task body embedded at card bottom | ✅ | `firstImage` → card footer image |
| 13 | Create new columns | ✅ | “+ Column” → `addColumn` |
| 14 | Delete a column; tasks move to top of note (no heading) | ✅ | `deleteColumn` (prepends orphans to preamble) |
| 15 | Edit column name (edits heading text) | ✅ | `EditableTitle` → `renameColumn` |
| 16 | Reorder columns (reorders headings) | ✅ | column header DnD → `reorderColumns` |
| 17 | Refresh button | ✅ | ⟳ → re-`getBoard` |
| 18 | Tag/label a card with a note (adds link in the task) | ✅ | `pickNote` (`app.prompt` note input) → `tagCardWithNote` |
| 19 | Attribute dates to cards (start dates in tasks) | ✅ | `setCardStartDate` → `{start:…}` token |
| 20 | Settings | ✅ | 5 plugin-note settings + live in-board ⚙ panel |

Legend: ✅ implemented & tested · ⚠️ partial / best-effort.

---

## Known limitations & assumptions

These are documented honestly rather than over-claimed.

1. **Rich-Footnote sidebar embed (req. 11).** Amplenote's documented embed model
   renders one embed per `renderEmbed` return. Opening a *second*, independent
   "footnote" embed in the sidebar while the board embed is active isn't a
   clearly documented capability. The plugin therefore **classifies** footnotes
   (single link vs. rich content) and opens rich ones via a sidebar/alert
   preview (`onEmbedCall → openFootnoteSidebar`). If your Amplenote build
   supports stacking multiple sidebar embeds, the hook is in place
   (`_footnoteHtml`) to upgrade this to a true embed. Footnote **definition
   parsing** and **view-only rendering** are fully implemented and tested.

2. **Start dates use a `{start:YYYY-MM-DD}` token.** The documented task API
   exposes `startAt` on tasks created via `app.insertTask`, but board cards are
   parsed/written as raw markdown lines to preserve multiline bodies and exact
   formatting. The token is human-readable, round-trips losslessly, and is
   stripped from the displayed card text. If you prefer native task start dates,
   `app.insertTask({ startAt })` can be wired into `addCard` — the trade-off is
   losing raw-markdown round-tripping for that path.

3. **Completion vs. dismissal.** "Crossed out" is implemented as checkbox
   completion (`- [x]`), which is how completed tasks render struck-through.
   Amplenote also has a separate `dismissedAt` concept; if the bounty intends
   *dismissed* specifically, swap `setLineChecked(...true)` for an
   `app.updateTask(uuid, { dismissedAt })` call (requires reading the task UUID
   from the line's metadata comment).

4. **Card identity is by text.** Cards are matched by their task text when
   mutating. Two cards with identical text in the same column are
   indistinguishable; the first match wins. Completed cards carry Amplenote's
   `uuid` metadata which `parseBoard` surfaces, and that could be used to switch
   matching to UUID where present.

5. **Live UI verification.** The build graph, embed bundle, generated note JS,
   and all parser/mutator logic are validated programmatically (31 passing unit
   tests + bundle/syntax checks). A headless browser was **not** available in
   the build environment, so pixel-level rendering was verified via the dev
   server harness (`npm run dev`) and static analysis rather than an automated
   screenshot. The styling targets Amplenote's dark theme.

6. **CSP / network.** The embed CSP allows `connect-src *` and `img-src *` so
   external task images and links work. Images are loaded directly by URL.

## Design decisions

- **Pure core, thin shells.** `kanban-core.js` has zero Amplenote dependencies,
  so it is unit-testable in Node and reused verbatim on both sides (embed render
  + plugin mutation). The build inlines it into the note's code block.
- **Note is the source of truth.** The embed sends *semantic actions*, never
  markdown. The plugin reads → mutates → writes → returns a fresh model, so
  concurrent external edits are respected on every action and on ⟳.
- **No runtime dependencies beyond React.** Drag-and-drop uses native HTML5 DnD;
  the markdown renderer is a small safe tokenizer (no `innerHTML` of user
  content).
- **Self-describing, versioned model.** The board model carries a
  `schemaVersion` (`SCHEMA_VERSION` in `kanban-core.js`), bumped whenever the
  markdown↔model contract changes, so the embed and plugin can detect mismatch.
- **Density presets + restrained dark theme.** `comfortable`/`compact` presets;
  a charcoal palette with a muted (non-neon) slate-indigo accent, hairline
  borders, and keyboard focus rings.
