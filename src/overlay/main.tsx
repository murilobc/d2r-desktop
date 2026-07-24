import React from "react";
import ReactDOM from "react-dom/client";
import "../i18n";
import OverlayRenderer from "./OverlayRenderer";
import "../App.css";

ReactDOM.createRoot(document.getElementById("overlay-root") as HTMLElement).render(
  <React.StrictMode>
    <OverlayRenderer />
  </React.StrictMode>,
);
