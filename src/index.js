import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import { BlinkingRequestsProvider } from "./components/blink/blink-cards"; // Import the provider

ReactDOM.render(
  <React.StrictMode>
    <BlinkingRequestsProvider>
      <App />
    </BlinkingRequestsProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
