import React from "react";
import ReactDOM from "react-dom/client";
import "../i18n";
import Widget from "./Widget";
import "./widget.css";

ReactDOM.createRoot(document.getElementById("widget-root") as HTMLElement).render(
  <React.StrictMode>
    <Widget />
  </React.StrictMode>,
);
