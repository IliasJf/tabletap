"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Printer,
  QrCode,
} from "lucide-react";
import "../admin/admin.css";

export interface QrPanelProps {
  shopId?: string;
  publicUrl?: string;
  restaurantName?: string;
}

export default function QrPanel({
  shopId,
  publicUrl,
  restaurantName = "Olive & Ember",
}: QrPanelProps) {
  const [base, setBase] = useState(publicUrl || "");
  const [table, setTable] = useState("");
  const [svg, setSvg] = useState("");
  const [feedback, setFeedback] = useState("");
  const [qrError, setQrError] = useState("");
  useEffect(() => {
    setBase(publicUrl || window.location.origin);
  }, [publicUrl]);

  const result = useMemo(() => {
    if (!base.trim())
      return {
        url: "",
        error: "Enter the website address for your menu.",
        local: false,
      };
    if (
      table &&
      (!/^\d+$/.test(table) || Number(table) < 1 || Number(table) > 99)
    )
      return {
        url: "",
        error: "Choose a table number from 1 to 99, or leave it blank.",
        local: false,
      };
    try {
      const url = new URL(base.trim());
      const local = ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(
        url.hostname,
      );
      if (
        (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
        url.username ||
        url.password
      )
        throw new Error();
      url.pathname = `${url.pathname.replace(/\/$/, "").replace(/\/menu$/, "")}/menu`;
      url.search = "";
      url.hash = "";
      if (shopId) url.searchParams.set("shop", shopId);
      if (table) url.searchParams.set("table", String(Number(table)));
      return { url: url.toString(), error: "", local };
    } catch {
      return {
        url: "",
        error: "Enter a complete HTTPS website address.",
        local: false,
      };
    }
  }, [base, table, shopId]);

  useEffect(() => {
    let active = true;
    setSvg("");
    setQrError("");
    setFeedback("");
    if (result.url) {
      QRCode.toString(result.url, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 4,
        width: 320,
        color: { dark: "#252b20", light: "#ffffff" },
      })
        .then((value) => {
          if (active) setSvg(value);
        })
        .catch(() => {
          if (active)
            setQrError(
              "The address is too long to turn into a QR code. Use a shorter website address.",
            );
        });
    }
    return () => {
      active = false;
    };
  }, [result.url]);

  function download() {
    const blobUrl = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `tabletap-menu${table ? `-table-${Number(table)}` : ""}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    setFeedback("QR code downloaded.");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.url);
      setFeedback("Menu link copied.");
    } catch {
      setFeedback("Select and copy the menu link below.");
    }
  }

  return (
    <div className="admin-qr-layout">
      <div className="admin-qr-settings">
        <h2>A menu on every table.</h2>
        <p>
          Customers scan, choose their food, and send their order on WhatsApp.
          Your QR code keeps working when you update the menu.
        </p>
        <label className="admin-field">
          Public website address
          <input
            type="url"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="https://your-cafe.com"
            autoComplete="url"
          />
        </label>
        <label className="admin-field">
          Table number <span className="admin-optional">optional</span>
          <input
            inputMode="numeric"
            type="number"
            min="1"
            max="99"
            value={table}
            onChange={(e) => setTable(e.target.value)}
            placeholder="For example, 5"
          />
          <small>
            Leave blank for a takeaway menu, or add a number for a table card.
          </small>
        </label>
        {(result.error || qrError) && (
          <p className="admin-error" role="alert">
            {result.error || qrError}
          </p>
        )}
        {result.local && (
          <p className="admin-notice">
            This is a local preview address. Enter your published website
            address before printing a QR code for customers.
          </p>
        )}
        {!shopId && (
          <p className="admin-note">
            This QR code opens the demo menu. Sign in and save your restaurant
            to create your own menu link.
          </p>
        )}
        <div className="admin-qr-actions">
          <button
            className="admin-primary"
            type="button"
            onClick={download}
            disabled={!svg}
          >
            <Download size={16} /> Download SVG
          </button>
          <button
            className="admin-secondary"
            type="button"
            onClick={() => window.print()}
            disabled={!svg}
          >
            <Printer size={16} /> Print table card
          </button>
        </div>
        {result.url && (
          <div className="admin-copy-link">
            <a href={result.url} target="_blank" rel="noopener noreferrer">
              {result.url}
              <ExternalLink size={14} />
            </a>
            <button type="button" onClick={copy} aria-label="Copy menu link">
              <Copy size={17} />
            </button>
          </div>
        )}
        <p className="admin-feedback" role="status">
          {feedback && (
            <>
              <Check size={15} /> {feedback}
            </>
          )}
        </p>
      </div>
      <div className="admin-qr-preview">
        <div className="admin-qr-card">
          <p className="admin-qr-name">{restaurantName}</p>
          <p className="admin-qr-headline">
            Something good
            <br />
            is on the menu.
          </p>
          <div
            className="admin-qr-code"
            aria-label={svg ? "QR code for the menu" : "QR code preview"}
          >
            {svg ? (
              <div dangerouslySetInnerHTML={{ __html: svg }} />
            ) : (
              <QrCode size={120} strokeWidth={1} />
            )}
          </div>
          <p className="admin-qr-instruction">Scan to explore & order</p>
          <p className="admin-qr-table">
            {table && !result.error
              ? `Table ${Number(table)}`
              : "Made for slow moments."}
          </p>
          <div className="admin-qr-brand">
            Menu by <strong>TableTap</strong>
          </div>
        </div>
        <span className="admin-preview-caption">Your printable table card</span>
      </div>
    </div>
  );
}
