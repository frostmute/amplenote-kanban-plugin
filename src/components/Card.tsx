import React, { useEffect, useRef, useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import type { BoardAction, Card as CardType } from "../types";

interface CardProps {
  task: CardType;
  index: number;
  columnTitle: string;
  onAction: (action: BoardAction) => void;
  onNavigateToNote?: (uuid: string) => void;
}

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const AMPLENOTE_RE = /^https:\/\/www\.amplenote\.com\/notes\/([a-zA-Z0-9-]+)$/;

function renderRichText(text: string, onNavigateToNote?: (uuid: string) => void): React.ReactNode {
  if (!text) return text;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const [, linkText, linkUrl] = match;
    const amp = linkUrl.match(AMPLENOTE_RE);
    if (amp && onNavigateToNote) {
      const uuid = amp[1];
      parts.push(
        <a
          key={`a-${key++}`}
          href={linkUrl}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onNavigateToNote(uuid);
          }}
          style={{ color: "#0052cc", cursor: "pointer", textDecoration: "none" }}
        >
          {linkText}
        </a>,
      );
    } else {
      parts.push(
        <a
          key={`a-${key++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ color: "#0052cc", textDecoration: "none" }}
        >
          {linkText}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

/**
 * The board shows a card's human-readable text only, so the replacement is sent
 * without a checkbox: `KanbanCore.editCard` carries over the original
 * completion state, `{start:…}` token and hidden Amplenote metadata.
 */
function buildMarkdownFromCard(task: CardType): string {
  const head = task.text.trim();
  if (task.body && task.body.trim().length > 0) {
    return `${head}\n${task.body}`;
  }
  return head;
}

const CLICK_SLOP_PX = 5;

export const Card: React.FC<CardProps> = ({ task, index, columnTitle, onAction, onNavigateToNote }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
    }
  }, [isEditing]);

  const commit = () => {
    setIsEditing(false);
    const next = editText.trim();
    if (!next || next === task.text) {
      setEditText(task.text);
      return;
    }
    const newMarkdown = buildMarkdownFromCard({ ...task, text: next });
    onAction({
      op: "editCard",
      args: { columnTitle, oldText: task.text, newMarkdown },
    });
  };

  // A press only counts as a drag when the pointer actually moved, so holding
  // a card in place still opens the editor on release.
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerOrigin.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: React.MouseEvent) => {
    const origin = pointerOrigin.current;
    pointerOrigin.current = null;
    if (origin) {
      const moved = Math.abs(e.clientX - origin.x) + Math.abs(e.clientY - origin.y);
      if (moved > CLICK_SLOP_PX) return;
    }
    setIsEditing(true);
  };

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            userSelect: "none",
            padding: 12,
            margin: "0 0 8px 0",
            backgroundColor: "#ffffff",
            borderRadius: 4,
            boxShadow: snapshot.isDragging
              ? "0 5px 10px rgba(0,0,0,0.15)"
              : "0 1px 2px rgba(9,30,66,0.25)",
            ...provided.draggableProps.style,
          }}
          onPointerDown={handlePointerDown}
          onClick={(e) => {
            e.stopPropagation();
            handleClick(e);
          }}
        >
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commit();
                } else if (e.key === "Escape") {
                  setIsEditing(false);
                  setEditText(task.text);
                }
              }}
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
          ) : (
            <>
              <div style={{ fontWeight: 500, color: "#172b4d", fontSize: 14, marginBottom: task.body ? 8 : 0 }}>
                {renderRichText(task.text, onNavigateToNote)}
              </div>
              {task.body && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#5e6c84",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    wordBreak: "break-word",
                  }}
                >
                  {renderRichText(task.body, onNavigateToNote)}
                </div>
              )}
              {task.firstImage && (
                <img
                  src={task.firstImage.url}
                  alt={task.firstImage.alt || "embedded image"}
                  style={{ maxWidth: "100%", marginTop: 8, borderRadius: 4 }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              {((task.labels && task.labels.length > 0) || task.startDate) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {task.startDate && (
                    <span
                      style={{
                        backgroundColor: "#ebecf0",
                        color: "#5e6c84",
                        padding: "2px 4px",
                        borderRadius: 3,
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      📅 {task.startDate}
                    </span>
                  )}
                  {task.labels &&
                    task.labels.map((label) => (
                      <span
                        key={label}
                        style={{
                          backgroundColor: "#e3fcef",
                          color: "#006644",
                          padding: "2px 4px",
                          borderRadius: 3,
                          fontSize: 12,
                        }}
                      >
                        #{label}
                      </span>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Draggable>
  );
};
