import React, { useCallback, useEffect, useRef, useState } from "react";
import { KanbanCore } from "./kanban-core";
import { Board as BoardComponent } from "./components/Board";
import type { Board as BoardModel, BoardAction, Column } from "./types";

declare global {
  interface Window {
    callAmplenotePlugin: (action: string, ...args: any[]) => Promise<any>;
  }
}

function boardFromMarkdown(markdown: string): { board: BoardModel; footnotes: Record<string, any> } {
  const parsed = KanbanCore.parseBoard(markdown);
  const footnotes = KanbanCore.parseFootnotes(markdown);
  const board: BoardModel = { columns: parsed.columns };
  return { board, footnotes };
}

function findColumnById(columns: Column[], id: string): Column | undefined {
  return columns.find((c) => c.id === id);
}

export default function Embed() {
  const [board, setBoard] = useState<BoardModel | null>(null);
  const [footnotes, setFootnotes] = useState<Record<string, any>>({});
  const [markdown, setMarkdown] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const markdownRef = useRef<string>("");

  const refresh = useCallback(async () => {
    if (!window.callAmplenotePlugin) {
      setError("Plugin bridge is not available");
      return;
    }
    try {
      const result = await window.callAmplenotePlugin("getBoard");
      const md = (result && result.markdown) || "";
      const { board: nextBoard, footnotes: nextFootnotes } = boardFromMarkdown(md);
      markdownRef.current = md;
      setMarkdown(md);
      setBoard(nextBoard);
      setFootnotes(nextFootnotes);
      setError(null);
    } catch (e) {
      setError((e && e.message) || String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applyAction = useCallback(
    async (action: BoardAction) => {
      if (!window.callAmplenotePlugin) {
        setError("Plugin bridge is not available");
        return;
      }
      try {
        const result = await window.callAmplenotePlugin("applyAction", { op: action.op, args: action.args });
        if (result && result.error) {
          setError(result.error);
          return;
        }
        const nextMd = (result && result.markdown) || markdownRef.current;
        if (nextMd === markdownRef.current) return;
        markdownRef.current = nextMd;
        setMarkdown(nextMd);
        const { board: nextBoard, footnotes: nextFootnotes } = boardFromMarkdown(nextMd);
        setBoard(nextBoard);
        setFootnotes(nextFootnotes);
        setError(null);
      } catch (e) {
        setError((e && e.message) || String(e));
      }
    },
    [],
  );

  const handleNavigateToNote = useCallback(async (uuid: string) => {
    if (!window.callAmplenotePlugin) return;
    try {
      const result = await window.callAmplenotePlugin("navigateToNote", { uuid });
      if (result && result.error) setError(result.error);
    } catch (e) {
      setError((e && e.message) || String(e));
    }
  }, []);

  // Only a failed *load* replaces the board; a rejected action shows a banner
  // so an unapplied edit never costs the user their board view.
  if (!board) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        {error ? (
          <>
            <p style={{ color: "#bf2600" }}>Kanban error: {error}</p>
            <button onClick={refresh}>Retry</button>
          </>
        ) : (
          <p>Loading board data...</p>
        )}
      </div>
    );
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            backgroundColor: "#ffebe6",
            borderBottom: "1px solid #ffbdad",
            color: "#bf2600",
            fontFamily: "system-ui, sans-serif",
            fontSize: 13,
          }}
        >
          <span style={{ flexGrow: 1 }}>{error}</span>
          <button onClick={refresh}>Retry</button>
          <button onClick={() => setError(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}
      <BoardComponent
        initialBoard={board}
        footnotes={footnotes}
        onAction={applyAction}
        onRefresh={refresh}
        onNavigateToNote={handleNavigateToNote}
      />
    </>
  );
}
