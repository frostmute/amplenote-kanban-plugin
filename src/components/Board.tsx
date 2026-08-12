import React, { useCallback, useEffect, useState } from "react";
import { DragDropContext, DropResult, Droppable, Draggable } from "@hello-pangea/dnd";
import type { Board as BoardType, BoardAction, Column } from "../types";
import { Column as ColumnComponent } from "./Column";

interface BoardProps {
  initialBoard: BoardType;
  footnotes?: Record<string, any>;
  onAction: (action: BoardAction) => Promise<void>;
  onRefresh: () => Promise<void>;
  onNavigateToNote?: (uuid: string) => void;
}

function stripLimit(title: string): { title: string; limit: number | null } {
  const m = title.match(/^(.*?)\s*\[(\d+)\]\s*$/);
  if (!m) return { title, limit: null };
  return { title: m[1].trim(), limit: parseInt(m[2], 10) };
}

export const Board: React.FC<BoardProps> = ({ initialBoard, onAction, onRefresh, onNavigateToNote }) => {
  const [board, setBoard] = useState<BoardType>(initialBoard);

  useEffect(() => {
    setBoard(initialBoard);
  }, [initialBoard]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, type } = result;
      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      if (type === "column") {
        const titles = board.columns.map((c) => c.title);
        const [movedTitle] = titles.splice(source.index, 1);
        titles.splice(destination.index, 0, movedTitle);
        onAction({ op: "reorderColumns", args: { order: titles } });
        return;
      }

      const sourceCol = board.columns.find((c) => c.id === source.droppableId);
      const destCol = board.columns.find((c) => c.id === destination.droppableId);
      if (!sourceCol || !destCol) return;
      const movedTask = sourceCol.tasks[source.index];
      if (!movedTask) return;

      const { title: toTitle, limit } = stripLimit(destCol.title);
      const isLastColumn = destCol === board.columns[board.columns.length - 1];
      const isBacklog = sourceCol.title === "(No heading)";
      const destIsBacklog = destCol.title === "(No heading)";
      // Mutators match on the exact heading text, `[n]` marker included.
      const fromColumn = isBacklog ? "" : sourceCol.title;
      const toColumn = destIsBacklog ? "" : destCol.title;
      const isMove = source.droppableId !== destination.droppableId;
      const finalIndex = isMove ? destination.index : destination.index + (destination.index > source.index ? 1 : 0);

      if (isMove && limit !== null && destCol.tasks.length >= limit) {
        window.alert(`"${toTitle}" is limited to ${limit} card${limit === 1 ? "" : "s"}.`);
        return;
      }

      onAction({
        op: "moveCard",
        args: {
          cardText: movedTask.text,
          fromColumn,
          toColumn,
          toIndex: finalIndex,
          markComplete: isLastColumn,
        },
      });
    },
    [board, onAction],
  );

  const handleAction = useCallback(
    (action: BoardAction) => {
      onAction(action);
    },
    [onAction],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#f4f5f7" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderBottom: "1px solid #dfe1e6",
        }}
      >
        <h1 style={{ fontSize: 14, fontWeight: 600, color: "#172b4d", margin: 0 }}>Markdown-Backed Kanban</h1>
        <button
          onClick={() => onRefresh()}
          title="Refresh from note"
          style={{
            background: "transparent",
            border: "1px solid #dfe1e6",
            borderRadius: 4,
            padding: "4px 8px",
            cursor: "pointer",
            color: "#172b4d",
            fontSize: 14,
          }}
        >
          ⟳ Refresh
        </button>
      </header>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="all-columns" direction="horizontal" type="column">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              style={{
                display: "flex",
                overflowX: "auto",
                padding: 16,
                gap: 16,
                flexGrow: 1,
                boxSizing: "border-box",
              }}
            >
              {board.columns.map((column, index) => (
                <Draggable key={column.id} draggableId={column.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      style={{ ...provided.draggableProps.style, display: "flex" }}
                    >
                      <ColumnComponent
                        column={column}
                        isFirst={index === 0}
                        onAction={handleAction}
                        onNavigateToNote={onNavigateToNote}
                        dragHandleProps={provided.dragHandleProps}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};
