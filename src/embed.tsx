import React, { useEffect, useState } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { KanbanCore } from "./kanban-core"
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

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { source, destination } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    if (!window.callAmplenotePlugin || !boardData) return;

    const sourceCol = boardData.columns.find((c: any) => c.id === source.droppableId);
    const destCol = boardData.columns.find((c: any) => c.id === destination.droppableId);
    if (!sourceCol || !destCol) return;

    const movedTask = sourceCol.tasks[source.index];
    const isLastColumn = destination.droppableId === boardData.columns[boardData.columns.length - 1].id;

    const nextMarkdown = KanbanCore.moveCardToIndex(boardData.markdown, {
      cardText: movedTask.text,
      fromColumn: sourceCol.title,
      toColumn: destCol.title,
      toIndex: destination.index,
      markComplete: isLastColumn
    });

    if (nextMarkdown === boardData.markdown) return;

    // Optimistic UI update
    const newBoard = JSON.parse(JSON.stringify(boardData));
    const newSourceCol = newBoard.columns.find((c: any) => c.id === source.droppableId);
    const newDestCol = newBoard.columns.find((c: any) => c.id === destination.droppableId);
    const [t] = newSourceCol.tasks.splice(source.index, 1);
    newDestCol.tasks.splice(destination.index, 0, t);
    if (isLastColumn) {
      t.completedAt = Math.floor(Date.now() / 1000);
    } else {
      t.completedAt = null;
    }
    newBoard.markdown = nextMarkdown;
    setBoardData(newBoard);

    try {
      await window.callAmplenotePlugin("replaceContent", { markdown: nextMarkdown });
    } catch (e) {
      console.error("Failed to update note", e);
      await fetchData();
    }
  };

  return (
    <div className="kanban-board">
      <h2>Amplenote Kanban</h2>
      {!boardData ? (
        <p>Loading board data...</p>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="board-columns">
            {boardData.columns.map((col: any) => (
              <Droppable droppableId={col.id} key={col.id}>
                {(provided) => (
                  <div
                    className="column"
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                  >
                    <h3>{col.title}</h3>
                    {col.tasks.map((task: any, index: number) => (
                      <Draggable draggableId={task.id} index={index} key={task.id}>
                        {(provided) => (
                          <div
                            className="card"
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...provided.draggableProps.style,
                              textDecoration: task.completedAt ? "line-through" : "none",
                              opacity: task.completedAt ? 0.6 : 1
                            }}
                          >
                            {task.text}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}

declare global {
  interface Window {
    callAmplenotePlugin: (action: string, ...args: any[]) => Promise<any>;
  }
}
