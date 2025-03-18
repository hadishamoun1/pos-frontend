import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import { BlinkingItemsProvider  } from "./components/blink/blink-cards"; // Import the provider

ReactDOM.render(
  <React.StrictMode>
    <BlinkingItemsProvider >
      <App />
    </BlinkingItemsProvider >
  </React.StrictMode>,
  document.getElementById("root")
);
