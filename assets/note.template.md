---
name: 'Markdown-Backed Kanban Board'
---

| | |
|-|-|
|name|Markdown-Backed Kanban Board|
|description|Transform any note into a polished kanban board. Columns are headings, cards are tasks, and every action edits the underlying markdown.|
|icon|view_column|
|instructions|**1.** Open the note you want to manage (headings become columns, tasks become cards).<br />**2.** Open the note options (•••) and choose **Open as Kanban Board**, or run **Create Kanban Board** from anywhere.<br />**3.** The board opens in the sidebar. Drag cards between columns, add/rename/reorder columns, and click a card to edit its raw markdown. Use ⟳ to refresh from the note.|
|setting|WIP limit per column (0 = unlimited)|
|setting|Last column completes cards|
|setting|Render first image in cards|
|setting|Render Rich Footnotes|
|setting|Board density (comfortable \| compact)|

```javascript
__KANBAN_CORE_PLACEHOLDER__

const KANBAN_ALLOWED_ACTIONS = new Set([
  "getBoard",
  "applyAction",
  "refresh",
  "navigateToNote",
]);

/** SHA-256 of the `build.html.json` this note was built with. */
const KANBAN_EMBED_SHA256 = "__KANBAN_EMBED_SHA256__";

const KANBAN_NOTE_UUID_RE = /^[a-zA-Z0-9-]{6,64}$/;

const KANBAN_ACTION_HANDLERS = {
  moveCard: (md, p) => KanbanCore.moveCardToIndex(md, {
    cardText: p.cardText,
    fromColumn: p.fromColumn,
    toColumn: p.toColumn,
    toIndex: typeof p.toIndex === "number" ? p.toIndex : Number.MAX_SAFE_INTEGER,
    markComplete: !!p.markComplete,
  }),
  addCard: (md, p) => KanbanCore.addCard(md, {
    columnTitle: p.columnTitle,
    text: p.text,
    startDate: p.startDate || null,
    linkNote: p.linkNote || null,
  }),
  editCard: (md, p) => KanbanCore.editCard(md, {
    columnTitle: p.columnTitle,
    oldText: p.oldText,
    newMarkdown: p.newMarkdown,
  }),
  setCardComplete: (md, p) => KanbanCore.setCardComplete(md, {
    columnTitle: p.columnTitle,
    cardText: p.cardText,
    complete: !!p.complete,
  }),
  deleteCard: (md, p) => KanbanCore.deleteCard(md, {
    columnTitle: p.columnTitle,
    cardText: p.cardText,
  }),
  addColumn: (md, p) => KanbanCore.addColumn(md, {
    title: p.title,
    level: typeof p.level === "number" ? p.level : 2,
  }),
  renameColumn: (md, p) => KanbanCore.renameColumn(md, {
    oldTitle: p.oldTitle,
    newTitle: p.newTitle,
  }),
  deleteColumn: (md, p) => KanbanCore.deleteColumn(md, { title: p.title }),
  reorderColumns: (md, p) => KanbanCore.reorderColumns(md, { order: p.order || [] }),
  setCardStartDate: (md, p) => KanbanCore.setCardStartDate(md, {
    columnTitle: p.columnTitle,
    cardText: p.cardText,
    date: p.date,
  }),
  tagCardWithNote: (md, p) => KanbanCore.tagCardWithNote(md, {
    columnTitle: p.columnTitle,
    cardText: p.cardText,
    noteName: p.noteName,
    noteUUID: p.noteUUID,
  }),
};

async function _kanbanFetchAttachment(app, attachmentUUID) {
  const url = await app.getAttachmentURL(attachmentUUID);
  if (!/^https:\/\/[^/]+/i.test(url)) {
    throw new Error("Refusing to proxy non-https attachment URL");
  }
  const proxyURL = new URL("https://plugins.amplenote.com/cors-proxy");
  proxyURL.searchParams.set("apiurl", url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response;
  try {
    response = await fetch(proxyURL.toString(), { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(`Attachment fetch failed: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function _kanbanSha256Hex(text) {
  const subtle = typeof crypto !== "undefined" && crypto.subtle;
  if (!subtle || typeof TextEncoder === "undefined") return null;
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The embed document is fetched back through a third-party CORS proxy, and it
 * carries the CSP that constrains the board, so it is validated before being
 * handed to the sidebar: byte-identical to what this note was built with, or
 * (when SubtleCrypto is unavailable) at least structurally ours.
 */
async function _kanbanValidateEmbedHtml(html) {
  const actual = await _kanbanSha256Hex(html);
  if (actual) {
    if (actual !== KANBAN_EMBED_SHA256) {
      throw new Error("Embed attachment failed its integrity check; refusing to render it.");
    }
    return html;
  }
  const cspMatch = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/i);
  const hasScriptSrc = /<script[^>]+src="(?!data:text\/javascript;base64,)/i.test(html);
  if (
    !html.startsWith("<!DOCTYPE html>") ||
    !cspMatch ||
    !/default-src 'none'/.test(cspMatch[1]) ||
    /unsafe-eval/.test(cspMatch[1]) ||
    hasScriptSrc
  ) {
    throw new Error("Embed attachment did not match the expected embed document; refusing to render it.");
  }
  return html;
}

function _kanbanEscapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

({
  appOption: {
    "Create Kanban Board": async function (app) {
      const opened = await app.openSidebarEmbed(1.8);
      if (opened === false) {
        await app.alert("The Kanban Board opens in the sidebar, which isn't available on this device.");
      }
    }
  },

  noteOption: {
    "Open as Kanban Board": async function (app, noteUUID) {
      const opened = await app.openSidebarEmbed(1.8, { noteUUID });
      if (opened === false) {
        await app.alert("The Kanban Board opens in the sidebar, which isn't available on this device.");
      }
    }
  },

  async renderEmbed(app, ...args) {
    try {
      const target = (args.find((a) => a && a.noteUUID) || {}).noteUUID;
      this._noteUUID = target || app.context.noteUUID;
      const attachments = await app.getNoteAttachments(app.context.pluginUUID);
      const attachment = attachments.find((a) => a.name === "build.html.json");
      if (!attachment) throw new Error("build.html.json attachment not found on the plugin note.");
      const html = await this._kanbanFetchAttachment(app, attachment.uuid);
      return await _kanbanValidateEmbedHtml(html);
    } catch (error) {
      return `<div style="font-family:sans-serif;color:#f88;padding:16px"><strong>Kanban renderEmbed error:</strong><br/>${_kanbanEscapeHtml(error && error.message ? error.message : String(error))}</div>`;
    }
  },

  _kanbanFetchAttachment,

  async onEmbedCall(app, action, payload) {
    payload = payload || {};
    if (!KANBAN_ALLOWED_ACTIONS.has(action)) {
      return { error: `Unknown action: ${action}` };
    }
    const uuid = this._noteUUID || app.context.noteUUID;
    const note = { uuid };
    const readMd = async () => (await app.getNoteContent(note)) || "";

    if (action === "getBoard") {
      return { markdown: await readMd() };
    }
    if (action === "refresh") {
      return { markdown: await readMd() };
    }
    if (action === "navigateToNote") {
      const target = payload.uuid;
      if (typeof target !== "string" || !KANBAN_NOTE_UUID_RE.test(target)) {
        return { error: "Invalid note uuid" };
      }
      await app.navigate(`https://www.amplenote.com/notes/${target}`);
      return { ok: true };
    }
    if (action === "applyAction") {
      const op = payload && payload.op;
      const args = (payload && payload.args) || {};
      const handler = KANBAN_ACTION_HANDLERS[op];
      if (!handler) {
        return { error: `Unknown op: ${op}` };
      }
      const current = await readMd();
      let next;
      try {
        next = handler(current, args);
      } catch (e) {
        return { error: `Mutator ${op} failed: ${(e && e.message) || String(e)}` };
      }
      if (typeof next !== "string" || next === current) {
        return { error: `Mutator ${op} produced no change` };
      }
      await app.replaceNoteContent(note, next);
      return { markdown: next };
    }
    return null;
  }
})
```

[build.html.json](attachment://build.html.json)
