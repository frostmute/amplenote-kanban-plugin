# Amplenote Plugin Audit Project

**Audited:** 2026-08-30  
**Scope:** current `main` of `amplenote-kanban-plugin`; official Amplenote plugin documentation; local build, tests, TypeScript, dependency audit, and development embed preview.

## Executive decision

Keep this repository as the implementation. It follows the supported embed-plugin architecture: the build produces an importable note archive with `build.html.json`, the note opens a sidebar embed, and the embed uses `window.callAmplenotePlugin` to request host mutations.

Do not add the older scaffold repository's source. Its only migration candidates remain its design documents.

The first implementation project is **lossless card identity**. The current mutation API selects a card by its visible text, so a normal note containing duplicate task text can mutate the wrong card.

## Official conventions and best practices

1. **Plugin source and delivery.** A plugin is a note containing metadata and a plugin code block. For an embed plugin, develop in an IDE, build the archive, import the generated note, and use GitHub-to-Amplenote for sustained iteration.
2. **Action contracts.** Plugin action functions receive `app` first and may return a value or promise. `onEmbedCall` arguments and results must round-trip through JSON; reject unknown actions and malformed payloads at that boundary.
3. **Embed boundary.** `renderEmbed` returns an isolated iframe document. The iframe cannot access the outer application; it calls its owning plugin through `window.callAmplenotePlugin`. `app.openSidebarEmbed` re-renders an existing sidebar using its latest arguments.
4. **Attachment loading.** Attachments retrieved with `app.getAttachmentURL` require Amplenote's CORS proxy. The proxy has an upstream allowlist; it is appropriate for the plugin attachment flow, but response status and a bounded timeout must be checked.
5. **Markdown preservation.** Treat the note markdown as user data. A mutation must preserve unrelated prose, footnotes, task metadata, headings, and nested task bodies. Structured, narrow mutations are preferable to serializing a UI model back over the entire note.
6. **Verification.** Test plugin logic in the IDE with mocked `app` objects; additionally exercise the generated note in Amplenote because the host action contracts and sidebar lifecycle cannot be verified by a browser-only preview.

## What is working

- The package pipeline has one active source of truth: `assets/note.template.md` is filled with the bundled UI and inlined `KanbanCore` mutators by `build.mjs`.
- The shipped note uses an explicit action allowlist and returns JSON-compatible response objects.
- Attachment loading validates HTTPS, bounds the request to 10 seconds, checks the response, and verifies the fetched embed with a generated SHA-256 digest before rendering it.
- The production iframe CSP constrains connections to `self` and `https://plugins.amplenote.com`; it does not use a wildcard `connect-src`.
- The core works through line-preserving markdown blocks rather than regenerating the whole note from React state. The test suite contains 33 focused parser, mutator, metadata, nested-task, image, and footnote cases.
- `npm run build` and `npm test` pass locally. `npm audit --omit=dev` reports no production dependency vulnerabilities.

## Findings

### P1 — visible card text is not a unique mutation identity

**Evidence**

- The UI sends `task.text` as `cardText` or `oldText` for move, edit, delete, completion, date, and tagging actions (`src/components/Board.tsx`, `src/components/Card.tsx`).
- Every corresponding core mutator selects the first card where `taskText(card.line) === cardText` (`src/kanban/mutate.ts`).
- A local reproduction with two `Duplicate` cards having distinct bodies deleted the first card when asked to delete the displayed second card; the remaining body was `second body`.

**Impact**

Editing, deleting, checking, dating, tagging, or moving the second of two same-named cards can change the first instead. This is normal user content, not an edge condition.

**Recommendation**

Change the action contract to identify the rendered source card by its index plus an expected original task line (or a stable Amplenote UUID when present). The mutator must verify that identity before writing and return a conflict error rather than mutating a different card. Migrate every card action together; retaining a text-only fallback would preserve the bug.

**Acceptance check**

Add a test with same-text cards having distinct bodies and metadata. Targeting each card must affect only that card; a changed expected line must fail without changing markdown.

### P1 — five plugin settings are declared but not implemented

**Evidence**

`assets/note.template.md` declares WIP limit, last-column completion, first-image rendering, Rich Footnotes, and density settings. No source code reads `app.settings`. The runtime instead:

- derives WIP from a heading suffix such as `To Do [2]`;
- always marks moves into the final column complete;
- always renders `task.firstImage`;
- parses and stores footnotes but `Board` does not consume its `footnotes` prop;
- contains no density mode.

**Impact**

The Amplenote plugin UI advertises configuration that does not affect behavior. This is a user-facing contract defect.

**Recommendation**

Choose one contract: implement all five settings through a JSON-safe `getSettings` bridge action, or remove the five metadata rows and document the currently fixed conventions. The smaller honest change is removal unless configurable behavior is a stated product requirement.

**Acceptance check**

For every metadata `setting` row, either a host-backed test demonstrates its effect or the row is absent.

### P2 — local mutations can race and lose a write

**Evidence**

`Board` invokes `onAction` without awaiting it. Every `applyAction` execution reads the current note, computes a replacement, then calls `app.replaceNoteContent` (`assets/note.template.md`). Two quick UI actions can both derive from the same markdown and the later replacement can overwrite the earlier one.

**Recommendation**

Serialize UI actions in the embed with one promise chain and refresh after a rejected operation. Preserve host errors. This protects one sidebar session; it does not solve concurrent edits from another client, so use the expected-card identity check above to fail safely when the source changed.

**Acceptance check**

A mocked bridge that delays two mutations must receive them in order and finish with both changes present.

### P2 — strict TypeScript is not a green gate

**Evidence**

`npx tsc --noEmit` currently exits with 13 diagnostics: ten in `src/kanban-core.test.ts` and three `unknown`-error accesses in `src/embed.tsx`. The core implementation files are also all marked `// @ts-nocheck`.

**Recommendation**

Make `npm run typecheck` run `tsc --noEmit`; fix the current diagnostics first. Then remove `@ts-nocheck` incrementally from the core while preserving the existing JavaScript-compatible generated note. Do not add a separate type system or duplicate the core.

**Acceptance check**

`npm run typecheck`, build, and tests all pass from a clean install.

### P2 — development dependency chain needs an update

**Evidence**

The full locked-tree audit reports four development-only vulnerabilities: direct `esbuild@0.21.5` (moderate) and transitive `nanoid`, `postcss`, and `undici` through Vitest/Vite/jsdom (three high). Production-only audit reports zero vulnerabilities. `npm ls` also reports the root `esbuild@0.21.5` invalid for the Vite version resolved under Vitest.

**Recommendation**

Upgrade the direct build and test tooling to compatible patched versions, regenerate only `package-lock.json`, then run the existing build, tests, typecheck, and full audit. This is developer-tooling risk, not a shipped-plugin runtime finding.

**Acceptance check**

`npm audit --json` contains zero vulnerabilities and `npm ls` contains no invalid dependency tree entries.

### P2 — host contract and UI behavior lack automated coverage

The 33 current tests give good coverage of markdown core behavior. They do not execute the generated plugin note against a mocked Amplenote `app`, verify bridge action validation, or exercise the React UI. The local preview confirmed the board loads and renders its controls, but it cannot validate `renderEmbed`, attachment loading, or `replaceNoteContent` against Amplenote.

**Recommendation**

Add only two contract layers:

1. a mocked-host test for `renderEmbed` and every allowed `onEmbedCall` action; and
2. a UI test for duplicate-card targeting, bridge error presentation, and ordered mutation dispatch.

After that, run an imported archive in Amplenote: open from `noteOption`, mutate a note with prose/footnotes/duplicate cards, verify reload, and verify the mobile sidebar-unavailable message.

### P3 — harden rendered markdown links and CSP

`Card.tsx` renders arbitrary Markdown link destinations as anchor `href` values. A local preview rendered `javascript:document.title='pwned'` verbatim; activating it opened a blank tab rather than executing the payload. Production does not need inline scripts because its JS is supplied as a `data:` source, yet it retains `script-src 'unsafe-inline'`.

**Recommendation**

Allow only `https:`, `http:`, and recognized Amplenote note URLs before rendering external links. Remove `'unsafe-inline'` from production `script-src` after a generated-archive smoke test. Keep inline styles until styling is moved to the already-supported CSS bundle.

### P3 — identify the product rather than the starter

`package.json` and the opening README sections still call this `amplenote-embed-starter`, despite this being a distinct Kanban plugin. Rename the package metadata and replace starter instructions with the archive import and release workflow. Do not rename source paths merely for branding.

## Delivery project

### Phase 1 — protect user notes

- [ ] Replace text-only card selectors with verified card identity across all actions and core mutators.
- [ ] Add same-text-card and stale-identity regression tests.
- [ ] Serialize embed mutations and display conflicts without replacing the displayed board.

**Done when:** duplicate cards and two quick local actions cannot silently modify or discard the wrong content.

### Phase 2 — make the host contract executable

- [ ] Add `npm run typecheck` and fix its current diagnostics.
- [ ] Add mocked-host tests for the generated note's render, bridge allowlist, error responses, and note replacement.
- [ ] Add the three UI behavior tests named above.
- [ ] Perform one manual imported-archive test in Amplenote on desktop and mobile.

**Done when:** CI catches core, bridge, and UI contract regressions, and an actual Amplenote host test has passed.

### Phase 3 — remove false surface and tooling risk

- [ ] Remove unimplemented settings or implement each one through a minimal bridge read.
- [ ] Upgrade locked development dependencies and clear the full audit.
- [ ] Restrict link schemes; tighten production script CSP after archive smoke testing.
- [ ] Rename starter metadata and rewrite the README release instructions.

**Done when:** displayed configuration, package identity, dependency state, and browser security policy all match the shipped behavior.

## Sources

- [Amplenote: Guide to Building Plugins](https://www.amplenote.com/help/guide_to_developing_amplenote_plugins) — IDE workflow, archive import, GitHub-to-Amplenote, and testing guidance. Accessed 2026-08-30.
- [Amplenote: Plugin API Reference](https://www.amplenote.com/help/developing_amplenote_plugins) — plugin-note model, current API surface, and execution context. Accessed 2026-08-30.
- [Amplenote: Actions](https://www.amplenote.com/help/developing_amplenote_plugins/actions) — `appOption`, `noteOption`, `renderEmbed`, and JSON bridge contracts. Accessed 2026-08-30.
- [Amplenote: App Interface](https://www.amplenote.com/help/developing_amplenote_plugins/app_interface) — `app.openSidebarEmbed` lifecycle and arguments. Accessed 2026-08-30.
- [Amplenote: CORS Proxy](https://www.amplenote.com/help/developing_amplenote_plugins/appendix_v) — attachment retrieval and proxy allowlist. Accessed 2026-08-30.
- [MDN: CSP `script-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src) — inline script policy trade-offs. Accessed 2026-08-30.
