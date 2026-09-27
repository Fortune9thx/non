import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";

import AppShell from "./components/AppShell";
import Landing from "./pages/Landing";
import Board from "./pages/Board";
import Cases from "./pages/Cases";
import CaseTicket from "./pages/CaseTicket";
import OpenCase from "./pages/OpenCase";
import Constitution from "./pages/Constitution";
import Claims from "./pages/Claims";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Board />} />
          <Route path="cases" element={<Cases />} />
          <Route path="cases/:caseId" element={<CaseTicket />} />
          <Route path="open" element={<OpenCase />} />
          <Route path="constitution" element={<Constitution />} />
          <Route path="claims" element={<Claims />} />
        </Route>
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
