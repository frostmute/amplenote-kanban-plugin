import React, { useEffect, useState } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import "./embed.css"

export default function Embed() {
  const [boardData, setBoardData] = useState<any>(null);

  const fetchData = async () => {
    if (window.callAmplenotePlugin) {
      try {
        const params = new URLSearchParams(window.location.search);
        const noteUUID = params.get("noteUUID");
        const data = await window.callAmplenotePlugin("getBoardData", noteUUID);
        setBoardData(data);
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
    const { source, destination, draggableId } = result;
    
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // Optimistic UI update
    const newBoard = JSON.parse(JSON.stringify(boardData));
    const sourceCol = newBoard.columns.find((c: any) => c.id === source.droppableId);
    const destCol = newBoard.columns.find((c: any) => c.id === destination.droppableId);
    
    const [movedTask] = sourceCol.tasks.splice(source.index, 1);
    destCol.tasks.splice(destination.index, 0, movedTask);
    
    // Is it the last column? (Bounty requirement: cross out task)
    const isLastColumn = destination.droppableId === newBoard.columns[newBoard.columns.length - 1].id;
    if (isLastColumn) {
      movedTask.completedAt = Math.floor(Date.now() / 1000);
    } else {
      movedTask.completedAt = null;
    }

    setBoardData(newBoard);

    if (window.callAmplenotePlugin) {
      await window.callAmplenotePlugin("moveTask", {
        taskId: draggableId,
        sourceColTitle: sourceCol.title,
        destColTitle: destCol.title,
        newIndex: destination.index,
        isLastColumn
      });
      // Optionally re-fetch to ensure perfect sync
      // await fetchData();
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
                            {task.content}
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
