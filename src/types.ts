export interface Card {
  id: string;
  text: string;
  body?: string;
  startDate?: string | null;
  labels?: string[];
  firstImage?: { alt: string; url: string } | null;
}

export interface Column {
  id: string;
  title: string;
  level?: number;
  tasks: Card[];
}

export interface Board {
  columns: Column[];
}

export type BoardAction =
  | { op: "moveCard"; args: { cardText: string; fromColumn: string; toColumn: string; toIndex: number; markComplete?: boolean } }
  | { op: "addCard"; args: { columnTitle: string; text: string; startDate?: string | null; linkNote?: { name: string; uuid: string } | null } }
  | { op: "editCard"; args: { columnTitle: string; oldText: string; newMarkdown: string } }
  | { op: "setCardComplete"; args: { columnTitle: string; cardText: string; complete: boolean } }
  | { op: "deleteCard"; args: { columnTitle: string; cardText: string } }
  | { op: "addColumn"; args: { title: string; level?: number } }
  | { op: "renameColumn"; args: { oldTitle: string; newTitle: string } }
  | { op: "deleteColumn"; args: { title: string } }
  | { op: "reorderColumns"; args: { order: string[] } }
  | { op: "setCardStartDate"; args: { columnTitle: string; cardText: string; date: string | null } }
  | { op: "tagCardWithNote"; args: { columnTitle: string; cardText: string; noteName: string; noteUUID: string } };
