import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

console.log('[main.tsx] 🚀 INITIALIZING REACT APPLICATION');
console.log('[main.tsx] Current URL:', window.location.href);
console.log('[main.tsx] Hash:', window.location.hash);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
