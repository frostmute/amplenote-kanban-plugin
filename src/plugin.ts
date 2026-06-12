export default {
  // Add an option to the Note menu to open the Kanban board
  noteOption: {
    check: function (this: any, app: any, noteUUID: string) {
      return "Open Kanban Board";
    },
    run: async function (this: any, app: any, noteUUID: string) {
      // Open an embed in the sidebar to render the Kanban UI
      // We pass the noteUUID so the embed knows which note to operate on
      app.openSidebarEmbed(`noteUUID=${noteUUID}`);
    }
  },

  // This is where we provide the HTML for the Kanban Board UI
  renderEmbed: function (this: any, app: any, ...args: any[]) {
    const params = new URLSearchParams(args[0]);
    const noteUUID = params.get("noteUUID");

    // We will build a robust HTML/JS SPA here
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: system-ui, sans-serif; background: #121212; color: #fff; margin: 0; padding: 20px; }
          .board { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; }
          .column { background: #1e1e1e; border-radius: 8px; width: 300px; flex-shrink: 0; padding: 10px; }
          .column-header { font-weight: bold; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #333; }
          .card { background: #2a2a2a; border-radius: 4px; padding: 10px; margin-bottom: 10px; cursor: grab; border: 1px solid #333; }
          .card:active { cursor: grabbing; }
        </style>
      </head>
      <body>
        <h2>Amplenote Kanban</h2>
        <div id="board" class="board">Loading...</div>

        <script>
          const noteUUID = "${noteUUID}";
          
          async function loadBoard() {
            // Call back into the plugin to fetch the note's headings (columns) and tasks (cards)
            const data = await window.callAmplenotePlugin("getBoardData", noteUUID);
            
            const boardEl = document.getElementById("board");
            boardEl.innerHTML = "";
            
            for (const col of data.columns) {
              const colEl = document.createElement("div");
              colEl.className = "column";
              colEl.innerHTML = \`<div class="column-header">\${col.name}</div>\`;
              
              for (const task of col.tasks) {
                const cardEl = document.createElement("div");
                cardEl.className = "card";
                cardEl.textContent = task.content;
                colEl.appendChild(cardEl);
              }
              
              boardEl.appendChild(colEl);
            }
          }

          // Initial load
          loadBoard();
        </script>
      </body>
      </html>
    `;
  },

  // This handles messages from the Kanban HTML embed (the UI)
  onEmbedCall: async function (this: any, app: any, action: string, ...args: any[]) {
    if (action === "getBoardData") {
      const noteUUID = args[0];
      const noteHandle = { uuid: noteUUID };
      
      // Get sections (which are based on headings = columns)
      const sections = await app.getNoteSections(noteHandle);
      
      // Get all tasks in the note
      const allTasks = await app.getNoteTasks(noteHandle);
      
      // Group tasks by section
      const columns = [];
      
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        if (section.heading) {
           columns.push({
             name: section.heading.text,
             tasks: [] // We need to figure out which tasks belong to this section
           });
        }
      }
      
      // NOTE: Amplenote's API currently doesn't easily tell us WHICH section a task is in directly from getNoteTasks.
      // We may need to get the full note content and parse it, or find a creative way to map tasks to headings.
      
      return { columns: columns };
    }
  }
};
