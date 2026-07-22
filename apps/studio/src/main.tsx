import React from "react";
import ReactDOM from "react-dom/client";
import { PlatformProvider } from "./platform/provider";
import Shell from "./shell/Shell";
import "./index.css";

const isTauri = "__TAURI_INTERNALS__" in window;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PlatformProvider mode={isTauri ? "pc" : "web"} webConfig={{ backendUrl: "http://localhost:3000", wsUrl: "ws://localhost:3000/ws/dap" }}>
      <Shell />
    </PlatformProvider>
  </React.StrictMode>,
);
