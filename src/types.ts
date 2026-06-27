export interface Card {
  id: string;
  text: string;
  body?: string;
}

export interface Column {
  id: string;
  title: string;
  tasks: Card[];
}

export interface Board {
  columns: Column[];
}
