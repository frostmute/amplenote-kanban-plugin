import React, { useEffect, useRef, useState } from "react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import type { BoardAction, Column as ColumnType } from "../types";
import { Card } from "./Card";

interface ColumnProps {
  column: ColumnType;
  isFirst: boolean;
  onAction: (action: BoardAction) => void;
  onNavigateToNote?: (uuid: string) => void;
  dragHandleProps?: any;
}

const LIMIT_RE = /^(.*?)\s*\[(\d+)\]\s*$/;
const NO_HEADING_TITLE = "(No heading)";

function splitLimit(title: string): { title: string; limit: number | null } {
  const m = title.match(LIMIT_RE);
  if (!m) return { title, limit: null };
  return { title: m[1].trim(), limit: parseInt(m[2], 10) };
}

function newCardId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `card-${crypto.randomUUID()}`;
  }
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const Column: React.FC<ColumnProps> = ({
  column,
  isFirst,
  onAction,
  onNavigateToNote,
  dragHandleProps,
}) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleText, setEditTitleText] = useState(() => splitLimit(column.title).title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.setSelectionRange(titleInputRef.current.value.length, titleInputRef.current.value.length);
    }
  }, [isEditingTitle]);

  const { title: titleOnly, limit } = splitLimit(column.title);
  const isBacklog = column.title === NO_HEADING_TITLE;
  const isNearLimit = limit !== null && column.tasks.length >= limit;
  const isOverLimit = limit !== null && column.tasks.length > limit;
  // Mutators match on the exact heading text, which keeps any `[n]` marker.
  const columnKey = isBacklog ? "" : column.title;

  const cancelAddTask = () => {
    setIsAddingTask(false);
    setNewTaskText("");
  };

  const submitAddTask = () => {
    const text = newTaskText.trim();
    setIsAddingTask(false);
    setNewTaskText("");
    if (!text) return;
    onAction({
      op: "addCard",
      args: { columnTitle: columnKey, text, startDate: null, linkNote: null },
    });
  };

  const submitTitle = () => {
    setIsEditingTitle(false);
    const newTitle = editTitleText.trim();
    if (!newTitle || newTitle === titleOnly) {
      setEditTitleText(titleOnly);
      return;
    }
    const { limit: typedLimit } = splitLimit(newTitle);
    const finalTitle = limit !== null && typedLimit === null ? `${newTitle} [${limit}]` : newTitle;
    onAction({ op: "renameColumn", args: { oldTitle: column.title, newTitle: finalTitle } });
  };

  const handleDeleteColumn = () => {
    if (!window.confirm(`Delete column "${titleOnly}"? Its tasks will move to the top of the note (no heading).`)) {
      return;
    }
    onAction({ op: "deleteColumn", args: { title: column.title } });
  };

  const handleAddColumn = () => {
    const name = window.prompt("Enter new column name:");
    if (!name || !name.trim()) return;
    onAction({ op: "addColumn", args: { title: name.trim(), level: 2 } });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 300,
        minWidth: 300,
        backgroundColor: isOverLimit ? "#ffebe6" : isNearLimit ? "#fffae6" : "#ebecf0",
        borderRadius: 8,
        padding: 8,
        boxSizing: "border-box",
        border: isOverLimit ? "2px solid #bf2600" : isNearLimit ? "2px solid #ff8b00" : "none",
        maxHeight: "100%",
      }}
    >
      <div
        {...dragHandleProps}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "0 0 12px 0",
          padding: "0 8px",
          cursor: isBacklog ? "default" : "grab",
        }}
      >
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            value={editTitleText}
            onChange={(e) => setEditTitleText(e.target.value)}
            onBlur={submitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitTitle();
              } else if (e.key === "Escape") {
                setIsEditingTitle(false);
                setEditTitleText(titleOnly);
              }
            }}
            style={{
              flexGrow: 1,
              fontSize: 16,
              fontWeight: 600,
              padding: 4,
              marginRight: 8,
              border: "1px solid #0052cc",
              borderRadius: 3,
            }}
          />
        ) : (
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#172b4d",
              margin: 0,
              cursor: isBacklog ? "default" : "text",
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (isBacklog) return;
              setEditTitleText(titleOnly);
              setIsEditingTitle(true);
            }}
          >
            {titleOnly}
            {limit !== null && (
              <span style={{ fontSize: 12, color: "#5e6c84", marginLeft: 8 }}>
                {column.tasks.length}/{limit}
              </span>
            )}
          </h3>
        )}
        {!isBacklog && !isFirst && (
          <button
            onClick={handleDeleteColumn}
            title="Delete column"
            style={{
              background: "transparent",
              border: "none",
              color: "#6b778c",
              cursor: "pointer",
              fontSize: 16,
              padding: 4,
            }}
          >
            &times;
          </button>
        )}
        {!isBacklog && isFirst && (
          <span
            title="First column cannot be deleted (it owns the implicit backlog)"
            style={{ color: "#a5adba", fontSize: 16, padding: 4 }}
          >
            &nbsp;
          </span>
        )}
      </div>

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              flexGrow: 1,
              minHeight: 100,
              overflowY: "auto",
              transition: "background-color 0.2s ease",
              backgroundColor: snapshot.isDraggingOver ? "#dfe1e6" : "transparent",
              borderRadius: 4,
            }}
          >
            {column.tasks.map((task, index) => (
              <Card
                key={task.id}
                task={task}
                index={index}
                columnTitle={columnKey}
                onAction={onAction}
                onNavigateToNote={onNavigateToNote}
              />
            ))}
            {provided.placeholder}
            {isAddingTask && (
              <div style={{ padding: "8px 0" }}>
                <textarea
                  autoFocus
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onBlur={submitAddTask}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitAddTask();
                    } else if (e.key === "Escape") {
                      cancelAddTask();
                    }
                  }}
                  placeholder="Enter task text..."
                  style={{
                    width: "100%",
                    minHeight: 40,
                    border: "1px solid #0052cc",
                    borderRadius: 3,
                    padding: 4,
                    fontFamily: "inherit",
                    fontSize: 14,
                    resize: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}
          </div>
        )}
      </Droppable>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {!isAddingTask ? (
          <button
            onClick={() => setIsAddingTask(true)}
            style={{
              flexGrow: 1,
              padding: 8,
              backgroundColor: "transparent",
              border: "none",
              borderRadius: 4,
              color: "#5e6c84",
              cursor: "pointer",
              textAlign: "left",
              fontWeight: 500,
              fontSize: 14,
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#dadce2")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            + Add task
          </button>
        ) : (
          <button
            // Keep focus on the textarea so its blur handler doesn't submit
            // the card before this cancel runs.
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancelAddTask}
            style={{
              flexGrow: 1,
              padding: 8,
              backgroundColor: "transparent",
              border: "none",
              borderRadius: 4,
              color: "#5e6c84",
              cursor: "pointer",
              textAlign: "left",
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleAddColumn}
          title="Add a new column"
          style={{
            padding: 8,
            backgroundColor: "transparent",
            border: "none",
            borderRadius: 4,
            color: "#5e6c84",
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 14,
            whiteSpace: "nowrap",
          }}
        >
          + Column
        </button>
      </div>
    </div>
  );
};

export { newCardId };
