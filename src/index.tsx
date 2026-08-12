import React from "react";
import { createRoot } from "react-dom/client";

import Embed from "./embed";
import { KanbanCore } from "./kanban-core";

declare const __KANBAN_DEV__: boolean;

if (__KANBAN_DEV__) {
  // `assets/embed.dev.html` mocks the plugin note by running the same mutators.
  (window as unknown as { KanbanCore: typeof KanbanCore }).KanbanCore = KanbanCore;
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <Embed />
    </React.StrictMode>,
  );
}
