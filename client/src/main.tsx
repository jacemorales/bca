import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { LoadingProvider } from "./contexts/LoadingContext";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LoadingProvider>
        <App />
      </LoadingProvider>
    </BrowserRouter>
  </React.StrictMode>
);
