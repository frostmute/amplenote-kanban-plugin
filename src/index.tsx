import React from "react";
import { createRoot } from "react-dom/client";

import Embed from "./embed";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <Embed />
    </React.StrictMode>,
  );
}
