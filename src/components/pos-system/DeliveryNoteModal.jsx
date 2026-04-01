import React, { useEffect, useMemo, useRef, useState } from "react";
import "./DeliveryNoteModal.css";
import { axiosClient } from "../api/axiosClient";
import revoLogoSrc from "../revo-logo/revo.png";

function safeNum(v, fallback = 0) {
  if (v === null || v === undefined) return fallback;
  const s = typeof v === "string" ? v.replace(/,/g, "").trim() : v;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

function fmtDate(d) {
  if (!d) return "";
  try {
    const dd = new Date(d);
    if (Number.isNaN(dd.getTime())) return String(d);
    return dd.toLocaleDateString();
  } catch {
    return String(d);
  }
}

function fmtNum(v, { max = 2, min = 0, blankZero = false } = {}) {
  if (v === "" || v === null || v === undefined) return "";
  const n = safeNum(v, NaN);
  if (!Number.isFinite(n)) return String(v ?? "");
  if (blankZero && Math.abs(n) < 1e-9) return "";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(n);
}

function fmtDim(v) {
  return fmtNum(v, { max: 2, min: 0, blankZero: true });
}

async function toBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

function buildDeliveryHtml(doc, isRevo, logoBase64) {
  const customerName = pick(doc, ["customerName", "clientName", "customer"]);
  const phone = pick(doc, ["telephone", "phone", "phoneNumber", "tel"]);
  const address = pick(doc, ["address", "customerAddress", "clientAddress"]);
  const date = pick(doc, ["requestDate", "invoiceDate", "date", "createdAt"]);

  const items =
    doc?.details || doc?.items || doc?.invoiceItems || doc?.lines || doc?.rows || [];

  const rows = (Array.isArray(items) ? items : []).map((it, idx) => {
    const itemNumber = pick(it, ["itemNumber", "itemNo", "number", "code"], idx + 1);
    const itemName = pick(it, ["itemName", "name", "item", "description"], "");
    const unitRaw = pick(it, ["unit", "unitName", "uom", "type", "itemType"], "");
    const unit = String(unitRaw || "").toUpperCase();
    const box = pick(it, ["box", "boxes"], "");
    const sheet = pick(it, ["sheet", "sheets", "qty", "quantity"], "");
    const length = pick(it, ["length", "len", "L"], "");
    const width = pick(it, ["width", "wid", "W"], "");
    const sqm = pick(it, ["sqm", "SQM"], "");

    return {
      itemNumber,
      itemName,
      unit,
      box,
      sheet,
      length,
      width,
      sqm,
    };
  });

  const rowsHtml = rows
    .map((r) => {
      const unitLower = String(r.unit || "").toLowerCase().trim();
      const isSheetUnit = unitLower === "sheet" || unitLower.includes("sheet");

      const boxText = isSheetUnit
        ? ""
        : fmtNum(r.box, { max: 2, min: 0, blankZero: true });

      const sheetText = fmtNum(r.sheet, { max: 2, min: 0, blankZero: true });
      const sqmText = fmtNum(r.sqm, { max: 2, min: 0, blankZero: true });

      return `
      <tr>
        <td class="delivery-note-tc">${r.itemNumber ?? ""}</td>
        <td class="delivery-note-td-name">${String(r.itemName ?? "")}</td>
        <td class="delivery-note-tr">${boxText}</td>
        <td class="delivery-note-tr">${sheetText}</td>
        <td class="delivery-note-tr">${fmtDim(r.length)}</td>
        <td class="delivery-note-tr">${fmtDim(r.width)}</td>
        <td class="delivery-note-tr">${sqmText}</td>
        <td class="delivery-note-tc">${r.unit ?? ""}</td>
      </tr>`;
    })
    .join("");

  const revoHeader = isRevo
    ? `
    <div style="display:flex;justify-content:space-between;padding:5px;border:1px solid #000;margin-bottom:8mm;height:130px;align-items:center;box-sizing:border-box;">
      <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:8px;">
        <img src="${logoBase64}" alt="Revo Logo" style="max-height:100px;max-width:180px;object-fit:contain;display:block;" />
      </div>
      <div style="text-align:right;direction:rtl;font-size:13px;line-height:1.4;font-family:Arial,sans-serif;">
        <h2 style="font-size:20px;margin:0;font-weight:bold;">REVO GLASS COMPANY</h2>
        <h2 style="font-size:20px;margin:0;font-weight:bold;">شــــــركـــة ريـــفـــو جــــلاس</h2>
        <p style="margin:0;font-weight:normal;">ســـوريـــا – حــلب – الــرامـوســة</p>

        <div style="display:flex;align-items:center;font-family:'Times New Roman',serif;font-size:13px;direction:rtl;">
          <span style="width:90px;text-align:right;">تلفون</span>
          <span style="width:10px;text-align:center;">:</span>
          <span style="direction:ltr;">+963 995118111</span>
        </div>

        <div style="display:flex;align-items:center;font-family:'Times New Roman',serif;font-size:13px;direction:rtl;">
          <span style="width:90px;text-align:right;">الاستفسار</span>
          <span style="width:10px;text-align:center;">:</span>
          <span style="direction:ltr;">+963 995434366</span>
        </div>

        <div style="display:flex;align-items:center;font-family:'Times New Roman',serif;font-size:13px;direction:rtl;">
          <span style="width:90px;text-align:right;">البريد الالكتروني</span>
          <span style="width:10px;text-align:center;">:</span>
          <span style="direction:ltr;">revo.glass.co@gmail.com</span>
        </div>
      </div>
    </div>`
    : ``;

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Delivery Note</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 10mm; }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      color: #111;
      background: #ececec;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .delivery-note-page {
      width: 210mm;
      min-height: 297mm;
      margin: 12px auto;
      background: #fff;
      padding: 12mm;
      box-shadow: 0 10px 30px rgba(0,0,0,0.18);
      border-radius: 2mm;
    }

    .delivery-note-title {
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 6px;
    }

    .delivery-note-muted {
      color: #666;
      margin-bottom: 10px;
    }

    .delivery-note-headerBox {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 14px;
    }

    .delivery-note-top {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }

    .delivery-note-leftMeta {
      flex: 1;
      font-size: 13px;
      line-height: 1.7;
    }

    .delivery-note-rightMeta {
      min-width: 220px;
      text-align: right;
      font-size: 13px;
      line-height: 1.7;
    }

    .delivery-note-rowLine b {
      display: inline-block;
      min-width: 95px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      font-size: 12.5px;
    }

    th {
      background: #f6f6f6;
      text-align: center;
    }

    .delivery-note-tc {
      text-align: center;
    }

    .delivery-note-tr {
      text-align: right;
    }

    .delivery-note-table-muted {
      color: #666;
      text-align: center;
    }

    .delivery-note-td-name {
      word-break: break-word;
      overflow-wrap: anywhere;
      direction: rtl;
    }

    @media print {
      body {
        background: #fff;
      }

      .delivery-note-page {
        width: auto;
        min-height: auto;
        margin: 0;
        padding: 0;
        box-shadow: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <div class="delivery-note-page">
    ${revoHeader}

    <div class="delivery-note-title">Delivery Note / اذن تسليم</div>
    <div class="delivery-note-muted">Delivery Note</div>

    <div class="delivery-note-headerBox">
      <div class="delivery-note-top">
        <div class="delivery-note-leftMeta">
          <div class="delivery-note-rowLine"><b>Customer:</b> ${customerName || ""}</div>
          <div class="delivery-note-rowLine"><b>Address:</b> ${address || ""}</div>
          <div class="delivery-note-rowLine"><b>Telephone:</b> ${phone || ""}</div>
        </div>

        <div class="delivery-note-rightMeta">
          <div class="delivery-note-rowLine"><b>Date:</b> ${fmtDate(date) || ""}</div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item No</th>
          <th>Item Name</th>
          <th>Box</th>
          <th>Sheet</th>
          <th>Length</th>
          <th>Width</th>
          <th>SQM</th>
          <th>Unit</th>
        </tr>
      </thead>
      <tbody>
        ${
          rowsHtml ||
          `<tr><td colspan="8" class="delivery-note-table-muted">No items</td></tr>`
        }
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

export default function DeliveryNoteModal({ open, onClose, doc }) {
  const iframeRef = useRef(null);
  const [isRevo, setIsRevo] = useState(false);
  const [logoBase64, setLogoBase64] = useState("");

  useEffect(() => {
    axiosClient
      .get("/company")
      .then(({ data }) => {
        const active = Array.isArray(data) ? data.find((c) => c.isActive) : null;
        const revo = !!active?.companyName?.toLowerCase().includes("revo");
        setIsRevo(revo);

        if (revo) {
          toBase64(revoLogoSrc).then(setLogoBase64);
        }
      })
      .catch(() => setIsRevo(false));
  }, []);

  const modalTitle = doc?.requestNumber || doc?.invoiceNumber || "Delivery Note";

  const srcDoc = useMemo(() => {
    return buildDeliveryHtml(doc || {}, isRevo, logoBase64);
  }, [doc, isRevo, logoBase64]);

  useEffect(() => {
    function onEsc(e) {
      if (e.key === "Escape") onClose?.();
    }

    if (open) window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  const handlePrint = () => {
    const w = iframeRef.current?.contentWindow;
    if (w) w.print();
  };

  if (!open) return null;

  return (
    <div className="delivery-note-overlay" onMouseDown={onClose}>
      <div
        className="delivery-note-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="delivery-note-header">
          <div className="delivery-note-title">{modalTitle}</div>
          <div className="delivery-note-actions">
            <button className="delivery-note-btn" onClick={handlePrint}>
              Print
            </button>
            <button
              className="delivery-note-btn delivery-note-danger"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <iframe
          ref={iframeRef}
          className="delivery-note-iframe"
          title={modalTitle}
          srcDoc={srcDoc}
          sandbox="allow-modals allow-same-origin"
        />
      </div>
    </div>
  );
}