# Code Review Issues — Amplenote Kanban Plugin

Repository: `frostmute/amplenote-kanban-plugin` (clone at `~/amplenote-kanban`).
Scope: full source tree under `src/`, build pipeline (`build.mjs`, `assets/`), and plugin contract in `note.md` / `assets/note.md`.

Build & test status observed locally: `npm install` succeeds, `npm test` runs 4/4 vitest cases (only `kanban-core.parseBoard` is exercised — no tests for the mutators, surgery, parser, serializer, plugin, or components), `npm run build` produces `build/build.html.json` and `build/plugin.zip` (note: README 2 advertises `dist/` but the build writes to `build/`; outputs are untracked by `.gitignore`).

---

## Critical Issues

1. **Two completely different plugin implementations are checked in; the shipping one is broken at runtime.** The repo contains two parallel plugin definitions that disagree on every contract detail:
   - `src/plugin.ts` — exports `noteOption("Open Board")` and an `onEmbedCall` that only knows actions `getBoardData` and `moveTask`. It reads `build.html.json` via the cors-proxy.
   - `assets/note.md` (and the identical `note.md` at the repo root, both bundled into `plugin.zip`) — defines `appOption("Create Kanban Board")` and `noteOption("Open as Kanban Board")` with an `onEmbedCall` that only knows `getBoard` and `replaceContent`.
   - `src/embed.tsx` calls `window.callAmplenotePlugin("getBoard")` and `"replaceContent"`. The `src/plugin.ts` handler ignores those actions and returns `null`. As a result, the embed built from `src/` against the plugin built from `assets/note.md` will silently fail to load or save any board state.
   - The build pipeline (`build.mjs`) packages whichever is in `assets/note.md` and the embed from `src/index.tsx`. Two of the three claimed runtime files (`index.tsx`, `embed.tsx`, `plugin.ts`, the entire `services/markdownSerializer.ts`, and the `dev.tsx` mock harness) are not wired into either definition that gets shipped.
   - `parseKanbanData` (`src/parser.ts`) is also orphaned: `plugin.ts` still imports it but the shipped plugin note defines no `getBoardData` action and `embed.tsx` instead parses markdown on its own through `KanbanCore.parseBoard`.
   - Fix: pick one contract and make every layer match it. Either (a) delete `src/plugin.ts` and `src/parser.ts`, expose only `KanbanCore.*` from the embed, and have the plugin note parse markdown itself; or (b) regenerate the plugin note to use the `getBoardData`/`moveTask` actions and route the embed through `moveTaskInMarkdown`. Don't ship both.

2. **`Card` rendered UI runs an uncontrolled, destructively serializing path that destroys the note on every drag, edit, add, or rename.** `src/components/Board.tsx:43`, `Board.tsx:89`, `Board.tsx:104`, `Board.tsx:127`, `Board.tsx:139`, `Board.tsx:176`, `Board.tsx:191` all pipe the current React state through `serializeBoardToMarkdown(newBoardState)` and then call `onBoardUpdate(markdown)` → `window.callAmplenotePlugin("replaceContent", { markdown })`.
   - `src/services/markdownSerializer.ts` is documented as destructive — it rebuilds the entire document from the React `Board`, emits `## ` (level-2) headings for *every* column including renamed ones, and never re-injects Amplenote's `<!-- {"uuid":...} -->` metadata comments. Multi-line card bodies (`task.body`), start dates (`{start:YYYY-MM-DD}`), labels, completed-task checkboxes (other than last column), and the implicit `(No heading)` backlog are silently dropped.
   - Net effect: any drag, edit, column rename, or card add on a real note obliterates its body, body text, and metadata, then writes the truncated result back. The build is so lossy that requirement 14 (delete a column → tasks move to "top of note under no heading") is implemented as the React path's behavior, but moving a card into the implicit backlog (`Column.tsx:148-160`) prepends a literal `Uncategorized` column with a fresh id instead of using the markdown preamble.
   - Fix: ship the AST-aware mutators in `kanban-core.ts` (`moveCard`, `moveCardToIndex`, `addCard`, `editCard`, `setCardComplete`, `deleteCard`, `addColumn`, `renameColumn`, `deleteColumn`, `reorderColumns`, `setCardStartDate`, `tagCardWithNote`) and call them from `Board.tsx`. Either pass structured actions through `onEmbedCall` (per the second implementation) or expose the core via the embed and have the plugin note translate them to the correct `app.*` calls.

3. **Embedded `nodeIntegration` is unnecessary and the plugin note ships a `connect-src *` / inline-script CSP that bypasses Amplenote's iframe sandboxing.** `assets/embed.html:5` allows `script-src 'self' 'unsafe-eval' 'unsafe-inline' data: blob:; … connect-src *;`. The bundled JS contains no `eval`/`new Function` calls, so `'unsafe-eval'` is unjustified. `connect-src *` lets the embed exfiltrate `boardData` (the full markdown of the user's note) to any host. Replace with the minimum needed (`script-src 'self' 'unsafe-inline' data:; connect-src 'self' https://plugins.amplenote.com`) and document the rationale.

## Major Issues

4. **`src/surgery.ts` regexes are fragile and silently misbehave on valid Amplenote notes.**
   - `surgery.ts:42-45` matches `^(\s*[-*+]\s+)\[[ \]]\]` but the task list is generated by `fromMarkdown`, which often uses `-` only; when a user edits a task to `*` or `+`, or to a tab-indented nested list, the checkbox rewrite silently fails and the task is dropped into the destination column with the wrong state.
   - `surgery.ts:46-54` collapses `\n\n` after removal, but if the removed task was the *only* item under a heading, the resulting `markdownWithoutTask` retains the heading followed by the next heading with no blank line, so the next paragraph attaches to the empty column.
   - `surgery.ts:88` `if (sibling.type === 'heading') break` stops the insertion scan at the next heading, but the function never walks the heading's *children* — if a heading contains only paragraphs (no list), `foundList` stays false and the fallback at `surgery.ts:111-114` injects `\n\n${taskStr}\n` *after the closing of the heading line* but the heading's body still follows, so the inserted task lands in the wrong section.
   - `surgery.ts:21-31` only matches listItems that contain a literal `<!-- {"uuid":"..."} -->` HTML node. Cards without a uuid (the common case for the implicit `(No heading)` backlog, new cards, and any card the user has hand-typed) can never be moved by `moveTaskInMarkdown`.
   - Fix: replace surgery with the in-tree structured model in `kanban-core.ts` (`moveCard`/`moveCardToIndex`) and route drag-end events through that. Test the round-trip on notes that include Setext headings, nested lists, footnotes, and HTML blocks.

5. **`plugin.ts`/`plugin` note duplicate the cors-proxy and have no retry, no timeout, and no error path that surfaces the failure.** Both `src/plugin.ts:26-30` and `assets/note.md:53-57` build `https://plugins.amplenote.com/cors-proxy?apiurl=…` and call `fetch(proxyURL).text()`. If the proxy 5xx's or the attachment URL has expired, the embed receives raw HTML (`response.text()`) instead of a JSON error. The `try/catch` returns `<div>renderEmbed error: …</div>`, which means the sidebar shows raw error strings (including potentially sensitive paths) to the user. Validate response status, fall back to `app.alert`, and don't return unescaped `error.toString()` from inside a markdown code block.

6. **`embed.tsx` silently drops state on the first failure and never reconciles with the note.** `src/embed.tsx:13-15` only reads `result?.markdown`, but the shipped plugin contract returns `{ markdown }` (ok) while the `src/plugin.ts` contract returns the `parseKanbanData` columns object (no `markdown`). On any failure path the UI sets `boardData` from the previous in-memory state — it never re-fetches. After the initial render, dragging always overwrites the note with React state, but the React state is stale if the user edits the note outside the embed; the README 2 documents a ⟳ refresh button that does not exist in `embed.tsx`/`Board.tsx`. Add a refresh action, react to `app.context.noteUUID` changes, and reconcile via diff (`KanbanCore.parseBoard(noteMarkdown)` → compare with local state → prompt before overwriting).

7. **`onEmbedCall` has no action allowlist and no auth on `replaceContent`.** `assets/note.md:60-77` accepts any `action` string and writes `payload.markdown` to whatever note `_noteUUID` resolves to. The state on `this` is set by the previous `renderEmbed` call, so a user opening a sidebar embed implicitly grants the embed authority to overwrite whatever note was last targeted. Combined with the CSP `connect-src *`, a hostile page inside the same Amplenote origin (or any cross-origin script reachable through a card's link) can call `window.callAmplenotePlugin("replaceContent", { markdown })` to clobber the most recently opened note. Add an explicit allowlist (`switch (action)` already exists, but `default: return null;` is fine — the problem is the `replaceContent` branch unconditionally writing without confirming the action originated from this embed's UI).

8. **Card ID generation in `Board.tsx` is unstable and collides with `KanbanCore`.** `Board.tsx:110` and `Board.tsx:184` mint ids `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` and `col-${Date.now()}-${…}`. After the destructive serializer runs, the next `parseBoard` reuses `${title}`-based ids (`kanban-core.ts:121`) or `card-${lineNo}` fallbacks (`kanban-core.ts:151`), so the React `key`s and the parser-derived ids diverge. `Math.random().toString(36).substr(2, 9)` is also `String.prototype.substr`, which is deprecated and may return short strings (collisions). Use `crypto.randomUUID()` and keep ids stable across re-renders (store id on the card model, not on the column).

9. **No tests cover the mutators, surgery, parser, plugin, or components.** `src/kanban-core.test.ts` exercises only `parseBoard` with 4 happy-path cases. The 14 mutators in `KanbanCore` (`kanban-core.ts:348-507`), `moveTaskInMarkdown` (`surgery.ts`), `parseKanbanData` (`parser.ts`), the destructive serializer (`services/markdownSerializer.ts`), and the React handlers in `Board.tsx` are all untested. README 2 advertises "31 unit tests"; the source has 4. Either delete the README claim, restore the test files (and the parser/serializer/surgery files the README references), or add tests for the actual shipped mutators.

10. **`src/plugin.ts` references API calls that don't exist on the `src/index.tsx` path.** `plugin.ts:39` reads `this.noteUUID` from `args[0]`, but `index.tsx` mounts `Embed` without ever setting `noteUUID`; the embed's `Embed` component receives no prop. The plugin handler in `plugin.ts` is a dead branch — it is never reachable from the bundled embed. Delete it, or wire `args[0]` through.

## Minor Issues

11. **Two lockfiles in the repo.** `package.json` ships with both `yarn.lock` and `package-lock.json`. `npm install` and `yarn install` will produce different trees. Pick one (recommend npm, since `package.json` is npm-shaped) and delete the other.

12. **`build.mjs` swallows esbuild errors and still writes the build artifacts.** `build.mjs:16-18` `console.error(errors)` and then continues. The `onEnd` callback returns without `return;` after the error, so `for (const file of outputFiles) { … }` runs against an undefined/empty `outputFiles`, and `path.dirname(outputFiles[0].path)` throws on the next line. Replace with `if (errors.length) return;` and surface the error to the process exit code.

13. **`note.md`/`assets/note.md` is duplicated and a third copy lives at the repo root.** `note.md` and `assets/note.md` are byte-identical, both tracked by git, and both feed into `build.mjs`. The plugin note has no comment block, settings parsing code, or schema migration; the metadata table relies on Amplenote's per-row cell-width comments that have historically broken parsing (see commit `0359801` "remove bad colwidth metadata and trailing slash"). Consider generating `assets/note.md` from a template and `assert`-ing that `note.md` is a symlink or hardlink to keep them in lockstep.

14. **`build.mjs` mutates HTML and CSS via global string replace.** `build.mjs:25-31` does `htmlContent = htmlContent.replace("__BASE64JAVASCRIPTCONTENT__", base64JavascriptContent)`. If the dependency ever inlines the literal token `__BASE64JAVASCRIPTCONTENT__` (e.g. a log message, a default-initialized string, a storybook fixture), the replace will silently double-replace. Use a placeholder that is unlikely to appear in JS (`/*__KANBAN_JS_PAYLOAD__*/`) or a unique marker (`crypto.randomUUID()` at build time, then `String.prototype.replaceAll`).

15. **`Card.tsx:12-70` `renderRichText` is a regex-based markdown renderer that misclassifies nested links, code spans, and escaped brackets.** `[a](b) [c](d)` works, but `[a](b(c))` produces `<a href="b(c">a</a>`, the regex inside backticks (`` `[a](b)` ``) is still rendered as a link, and backslash-escaped brackets (`\[link\]`) are not. The intended surface is card text + a 3-line body, so a true markdown parser (`mdast-util-from-markdown`, already a dependency) is safer.

16. **`Card.tsx:120-125` enters edit mode on any card click, including during drag.** The `if (!snapshot.isDragging)` guard helps, but `@hello-pangea/dnd` only flips `snapshot.isDragging` once the drag handle's threshold is crossed. A fast click-and-release immediately after a failed drag attempt opens the editor unintentionally. Consider `onMouseDown`/`onPointerDown` to seed a "potential drag" state, or require a deliberate `dblclick`.

17. **`Column.tsx:74-75` "near limit" and "over limit" thresholds are based on the literal `column.title` regex `\[(\d+)\]`.** Users can collide the WIP marker with markdown link syntax (`[label](https://…)` would be parsed as a limit of 0 and freeze the column). Use a more specific marker (`<!-- wip:5 -->` or a per-column frontmatter) and surface the parsed value in the column model.

18. **`Column.tsx:148-160` `handleDeleteColumn` adds an "Uncategorized" column instead of the implicit `(No heading)` backlog.** `kanban-core.ts:455-468` correctly prepends orphaned tasks to the preamble, but the React path silently changes the contract. Reconcile: either use `kanban-core.deleteColumn` everywhere or document that the React path is destructive.

19. **`src/dev.tsx:9` calls `onBoardUpdate` with `console.log`, but `Board.tsx` types `onBoardUpdate` as `(markdown: string) => void`.** Mismatched signature is fine in JS, but the dev harness never exercises the failure branch (no `await` and no exception path), so a developer testing locally can't reproduce the `fetchData()`-on-failure revert documented at `embed.tsx:33-34`.

20. **`embed.css` ships a hard-coded dark theme (`background-color: #121212`)** but `embed.tsx`/`Board.tsx` use a light theme (`#f4f5f7`, `#ebecf0`, `#ffffff`). The CSS file is dead — `Board.tsx` and `Column.tsx` set every visible color inline. Either delete `embed.css` or actually use its classes.

21. **`parse_readme.py` is tracked in the repo but no script references it.** Dead file. Remove it or wire it to `npm run docs:sync`.

22. **`@types/node@^26.0.1`** is the latest at clone time, but `tsconfig.json` does not include `types: ["node"]`. TypeScript falls back to a default lib, so the runtime `process.env` access in `build.mjs` (not TS) and the `import.meta`/CJS interop is fine, but `@types/node` should be a devDependency only — it is, but its version pin (a major that may not match Node 22) is suspicious. Run `npm ls @types/node` to confirm.

23. **`src/components/Card.tsx:120` the entire card is a drag handle.** Click-to-edit and drag-to-move both compete for the same gesture. Lift the edit affordance into a dedicated icon (matches Trello/Notion UX) and keep the body for drag.

## Suggestions

24. The `kanban-core` module is well-factored; expose it as a single `kanban.bundle.js` from the embed so the embed handles *all* markdown I/O locally and the plugin note shrinks to a thin shim that only forwards `app.getNoteContent`/`replaceNoteContent`. That removes the two-contract problem entirely.

25. The dev/playbook workflow under `.claude/` (commands, skills, agents) is shipped in the repo and adds ~200 MB of tracked files. Consider a `git submodule` so the plugin's git history stays clean, and `.gitignore` the `.claude-flow/` metrics.

26. `note.md.patch` and `build.mjs.patch` are tracked at the repo root and contradict the actual `note.md`/`build.mjs`. They appear to be diff artifacts from the prior `git diff` iteration. Remove them, or move them to a `.patches/` directory referenced from CI.

27. Add `dangerouslySetInnerHTML` to a sanitizer before letting the embed render card bodies — `task.body` is user input and is currently rendered as a plain string in `Card.tsx:153`, which is safe, but any future addition of HTML rendering needs a sanitizer (`DOMPurify`).

28. Consider pinning the `@hello-pangea/dnd` (`^18.0.1`) to a known-good patch; the library has shipped several Strict-Mode regressions, and `embed.tsx` mounts under `React.StrictMode`.

29. `parseFootnotes` and `classifyFootnote` are exported from `kanban-core` but no UI code calls them. The settings list claims "Render Rich Footnotes: true", but the embed does not render them. Either implement the rendering in `Card.tsx`/`Column.tsx` or remove the setting.

30. The build CSP in `embed.html` could be replaced with a `nonce` once Amplenote supports it; the current `'unsafe-inline'` blanket is a CSP antipattern.

---

## Positive Observations

- The `kanban-core.ts` module is the cleanest part of the codebase: a pure, dependency-free markdown ↔ model layer that the README 2 design pitch describes correctly and that `parseBoard` exercises with 4 passing tests.
- The use of `react-jsx`, `process.env.NODE_ENV` define, `iife` format, and `__BASE64JAVASCRIPTCONTENT__` injection is the standard Amplenote embed pattern; the build pipeline (apart from the silent-error issue) is on rails.
- The CSP `'unsafe-eval'` scrubbing in `build.mjs:25-26` and the historical commits (`6f6f2c4`, `3244906`) show a working `eval`/`new Function` removal pipeline.
- The 4 vitest cases assert behaviour the README cares about (implicit backlog, multi-line body, hidden UUID comment).
- Conventional commit history (`feat:`, `fix:`, `chore:`, `build:`) is consistent.

## Test Gap Analysis

| Area | Tests | Notes |
|---|---|---|
| `KanbanCore.parseBoard` | 4 | happy paths only |
| `KanbanCore.parseTaskLine`, `firstImage`, `extractUrls`, `parseFootnotes`, `cardFootnoteIds`, `classifyFootnote` | 0 | untested |
| `KanbanCore.structure` / `serialize` | 0 | no round-trip tests |
| All 14 mutators in `KanbanCore` | 0 | core feature, untested |
| `src/parser.ts` (legacy `parseKanbanData`) | 0 | dead in shipped contract |
| `src/surgery.ts` (`moveTaskInMarkdown`) | 0 | no coverage of `newIndex` boundary, no `foundList` fallback, no listItem-without-uuid branch |
| `src/services/markdownSerializer.ts` | 0 | destructive; not covered |
| `src/plugin.ts` | 0 | not invoked from any test |
| `assets/note.md` plugin object | 0 | no integration test against `app` mock |
| `src/components/{Board,Column,Card}.tsx` | 0 | no `@testing-library/react` usage despite the dep |
| `build.mjs` build pipeline | 0 | no esbuild dry-run or fixture |

README 2 advertises "31 parser/mutator unit tests (node:test)"; the source ships 4.
