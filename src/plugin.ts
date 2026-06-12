import { parseKanbanData } from "./parser";
import { moveTaskInMarkdown } from "./surgery";

export default {
  // Add an option to the Note menu to open the Kanban board
  noteOption: {
    check: function (this: any, app: any, noteUUID: string) {
      return "Open Kanban Board";
    },
    run: async function (this: any, app: any, noteUUID: string) {
      // Open an embed in the sidebar to render the Kanban UI
      app.openSidebarEmbed(`noteUUID=${noteUUID}`);
    }
  },

  // This is where we provide the HTML for the Kanban Board UI
  renderEmbed: async function (this: any, app: any, ...args: any[]) {
    const params = new URLSearchParams(args[0]);
    this.noteUUID = params.get("noteUUID");

    try {
      const attachments = await app.getNoteAttachments(app.context.pluginUUID);
      const attachment = attachments.find((a: any) => a.name === "build.html.json");
      if (!attachment) throw new Error("build.html.json attachment not found");
      
      const url = await app.getAttachmentURL(attachment.uuid);
      const proxyURL = new URL("https://plugins.amplenote.com/cors-proxy");
      proxyURL.searchParams.set("apiurl", url);
      const response = await fetch(proxyURL);
      return response.text();
    } catch (error: any) {
      return `<div><em>renderEmbed error:</em> ${ error.toString() }</div>`;
    }
  },

  // This handles messages from the Kanban HTML embed (the UI)
  onEmbedCall: async function (this: any, app: any, action: string, ...args: any[]) {
    if (action === "getBoardData") {
      const noteHandle = { uuid: this.noteUUID };
      const markdown = await app.getNoteContent(noteHandle);
      const boardData = await parseKanbanData(app, markdown);
      return boardData;
    }
    
    if (action === "moveTask") {
      const payload = args[0];
      const { taskId, sourceColTitle, destColTitle, newIndex, isLastColumn } = payload;
      
      const noteHandle = { uuid: this.noteUUID };
      const markdown = await app.getNoteContent(noteHandle);
      const boardData = await parseKanbanData(app, markdown);
      
      // Amplenote API lets us move tasks or replace section content.
      // But moving a task between headings is tricky using just app.updateTask, 
      // because there's no `heading` or `section` property on a task update.
      // The bounty requirement: "Dragging and dropping a card between columns also moves it between headings"
      
      // 1. We must read the raw markdown.
      // 2. Identify the task's text block.
      // 3. Remove it from the source heading section.
      // 4. Insert it into the destination heading section at the right index.
      
      const sourceSection = { heading: { text: sourceColTitle } };
      const destSection = { heading: { text: destColTitle } };
      
      // If it's the last column, we mark it crossed out
      if (isLastColumn) {
        await app.updateTask(taskId, { completedAt: Math.floor(Date.now() / 1000) });
      }
      
      // 1. Calculate the new markdown string with the AST surgery tool
      const newMarkdown = moveTaskInMarkdown(markdown, taskId, destColTitle, newIndex, isLastColumn);
      
      // 2. Diff and rewrite (Full document replace is safest here since cross-section dragging
      // breaks Amplenote's targeted `replaceNoteContent({ section })` bounds)
      await app.replaceNoteContent(noteHandle, newMarkdown);
      
      return true;
    }
    
    return null;
  }
};
