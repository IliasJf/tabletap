import React from "react";
import { createRoot } from "react-dom/client";
import Restaurant from "../app/components/Restaurant";
import AdminPage from "../app/admin/page";
import QrPage from "../app/qr/page";
import Credits from "../app/credits/page";

const path = window.location.pathname;
const screen =
  path === "/admin" ? (
    <AdminPage />
  ) : path === "/qr" ? (
    <QrPage />
  ) : path === "/credits" ? (
    <Credits />
  ) : (
    <Restaurant menuOnly={path === "/menu"} />
  );
createRoot(document.getElementById("root")!).render(screen);
