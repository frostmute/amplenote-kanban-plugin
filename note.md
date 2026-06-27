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
      this._kanbanTargetNote = noteUUID;
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
      return await this._getAttachmentContent(app, attachment.uuid);
    } catch (error) {
      return `<div style="font-family:sans-serif;color:#f88;padding:16px">
        <strong>Kanban renderEmbed error:</strong><br/>${error.toString()}</div>`;
    }
  },

  async _getAttachmentContent(app, attachmentUUID) {
    const url = await app.getAttachmentURL(attachmentUUID);
    const proxyURL = new URL("https://plugins.amplenote.com/cors-proxy");
    proxyURL.searchParams.set("apiurl", url);
    const response = await fetch(proxyURL);
    return response.text();
  },

  async onEmbedCall(app, action, payload) {
    payload = payload || {};
    const uuid = this._noteUUID || app.context.noteUUID;
    const note = { uuid };
    const readMd = async () => (await app.getNoteContent(note)) || "";

    switch (action) {
      case "getBoard": {
        return { markdown: await readMd() };
      }
      case "replaceContent": {
        await app.replaceNoteContent(note, payload.markdown);
        return true;
      }
      default:
        return null;
    }
  }
})
```

[build.html.json](attachment://build.html.json)
