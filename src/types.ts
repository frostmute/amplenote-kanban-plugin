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
  tasks: Card[];
}

export interface Board {
  columns: Column[];
}
