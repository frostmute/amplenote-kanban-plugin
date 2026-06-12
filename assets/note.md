---
name: 'Plugin: Kanban board'
---

| | |
|-|-|
|name<!-- {"cell":{"colwidth":123}} -->|Kanban Board<!-- {"cell":{"colwidth":779}} -->|
|description<!-- {"cell":{"colwidth":123}} -->|A plugin to transform your notes into a customizable kanban board for streamlined task management.<!-- {"cell":{"colwidth":779}} -->|
|icon<!-- {"cell":{"colwidth":123}} -->|dashboard<!-- {"cell":{"colwidth":779}} -->|
|Instructions<!-- {"cell":{"colwidth":123}} -->|[^1]|
\

# Code block

```
({
  async noteOption(app, noteUUID) {
    app.insertNoteContent({ uuid: noteUUID }, `<object data="plugin://${app.context.pluginUUID}?${noteUUID}" data-aspect-ratio="1" />`);
  },
  async renderEmbed(app, ...args) {  
    this.noteUUID = args[0];
    try {
      const attachments = await app.getNoteAttachments(app.context.pluginUUID);
      const attachment = attachments.find(attachment => attachment.name === "build.html.json");
      if (!attachment) throw new Error("build.html.json attachment not found");
      return this._getAttachmentContent(app, attachment.uuid);
    } catch (error) {
      return `<div><em>renderEmbed error:</em> ${ error.toString() }</div>`;
    }
  },
  async onEmbedCall(app, ...args) {
    // This is where we will handle the RPC calls from the React UI
    const action = args[0];
    
    if(action === "get_data") {
      const markdown = await app.getNoteContent({ uuid: this.noteUUID });
      // TODO: parse the markdown into sections and tasks
      return { columns: [{ id: "col-1", title: "To Do", tasks: [{ id: "task-1", content: "Implement AST parser" }] }] };
    }
    
    return "result";
  },
  
  async _getAttachmentContent(app, attachmentUUID) {
    const url = await app.getAttachmentURL(attachmentUUID);
    const proxyURL = new URL("https://plugins.amplenote.com/cors-proxy");
    proxyURL.searchParams.set("apiurl", url);
    const response = await fetch(proxyURL);
    return response.text();
  }
})
```

[build.html.json](attachment://PLACEHOLDER)

[^1]: 
    **Usage Instructions:**

    1. **Create a New Note:** Begin by creating a new note.

    1. **Activate Kanban View:** Click the three dots in the top right corner, then select **"Kanban Plugin: Create Board"** to transform the note into a kanban board.
