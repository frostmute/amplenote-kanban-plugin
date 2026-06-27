import React, { useEffect, useState } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { KanbanCore } from "./kanban-core"
import { Board as BoardComponent } from "./components/Board"
import "./embed.css"

export default function Embed() {
  const [boardData, setBoardData] = useState<any>(null);

  const fetchData = async () => {
    if (window.callAmplenotePlugin) {
      try {
        const result = await window.callAmplenotePlugin("getBoard");
        const markdown = result?.markdown || "";
        const { columns } = KanbanCore.parseBoard(markdown);
        const footnotes = KanbanCore.parseFootnotes(markdown);
        setBoardData({ columns, footnotes, markdown });
      } catch (e) {
        console.error("Failed to fetch board data", e);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBoardUpdate = async (markdown: string) => {
    if (!window.callAmplenotePlugin) return;
    try {
      await window.callAmplenotePlugin("replaceContent", { markdown });
    } catch (e) {
      console.error("Failed to update note", e);
      await fetchData(); // Revert on failure
    }
  };

  const handleNavigateToNote = async (uuid: string) => {
    if (window.callAmplenotePlugin) {
      try {
        await window.callAmplenotePlugin("navigateToNote", { uuid });
      } catch (e) {
        console.error("Failed to navigate to note", e);
      }
    }
  };

  return (
    <div className="kanban-board-container">
      {!boardData ? (
        <p>Loading board data...</p>
      ) : (
        <BoardComponent 
           initialBoard={{ columns: boardData.columns }} 
           onBoardUpdate={handleBoardUpdate}
           onNavigateToNote={handleNavigateToNote}
        />
      )}
    </div>
  );
}

declare global {
  interface Window {
    callAmplenotePlugin: (action: string, ...args: any[]) => Promise<any>;
  }
}
