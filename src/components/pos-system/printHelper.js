const FRAME_ID = '__revo_print_frame__';

function execPrint(iframe) {
  const run = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    iframe.contentWindow.addEventListener('afterprint', () => iframe.remove(), { once: true });
  };
  if (iframe.contentDocument.readyState === 'complete') {
    requestAnimationFrame(run);
  } else {
    iframe.onload = () => requestAnimationFrame(run);
  }
}

// For simple HTML reports (Customer Activity, Customer Balances, Trial Balance)
export function printHtml(htmlContent) {
  document.getElementById(FRAME_ID)?.remove();

  // Extract <style> tags so they go in <head> for proper @page support
  const tmp = document.createElement('div');
  tmp.innerHTML = htmlContent;
  const styleText = Array.from(tmp.querySelectorAll('style')).map((s) => s.textContent).join('\n');
  tmp.querySelectorAll('style').forEach((s) => s.remove());

  const iframe = document.createElement('iframe');
  iframe.id = FRAME_ID;
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"/><style>${styleText}</style></head><body>${tmp.innerHTML}</body></html>`);
  doc.close();

  execPrint(iframe);
}

// For Account Statement — receives the iframe body as container for DOM-building + pagination
export function printWithDomBuilder(buildFn) {
  document.getElementById(FRAME_ID)?.remove();

  const iframe = document.createElement('iframe');
  iframe.id = FRAME_ID;
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:190mm;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  body { margin: 0; padding: 0; }
  .print-page { position: relative; width: 190mm; height: 277mm; display: flex; flex-direction: column; box-sizing: border-box; page-break-after: always; overflow: hidden; }
  .print-page:last-child { page-break-after: auto; }
  .page-header { flex: 0 0 auto; }
  .page-body { flex: 1 1 auto; display: flex; flex-direction: column; }
  .statement-report-modal-a4 { width: 190mm; margin: 0; padding: 0; box-shadow: none; border: 0; }
  .statement-report-modal-table { width: 100%; border-collapse: collapse; table-layout: fixed; border-spacing: 0; }
  .statement-report-modal-table th, .statement-report-modal-table td { border: 1px solid #000; padding: 6px 8px; font-size: 13px; line-height: 1.2; }
  .statement-report-modal-table thead th { position: static !important; background: #f3f4f6; }
  .statement-report-modal-table tr { break-inside: avoid; page-break-inside: avoid; }
  .statement-report-modal-footer-row td { font-weight: 700; }
  .statement-report-modal-footer-row td.footer-spacer { border: none !important; background: transparent !important; }
  .statement-report-modal-footer-row td.footer-label { }
  .statement-report-modal-footer-row td.footer-label, .statement-report-modal-footer-row td.footer-amount { font-size: 16px; line-height: 1.25; font-weight: 700; }

  /* ── Shamoun/Revo header ── */
  .statement-report-modal-header {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    padding: 8px 10px; border: 1px solid #000; margin: 8px;
    min-height: 138px; align-items: start; box-sizing: border-box;
    direction: rtl; font-family: "Times New Roman", Times, serif;
  }
  .statement-report-modal-header-right,
  .statement-report-modal-header-left { display: flex; flex-direction: column; gap: 4px; }
  .statement-report-modal-header-right { text-align: right; direction: rtl; font-size: 15px; line-height: 1.25; }
  .statement-report-modal-header-left { direction: ltr; text-align: left; font-size: 15px; line-height: 1.25; }
  .statement-report-modal-header-left p { margin: 0; }
  .statement-report-modal-company-arabic-title { font-size: 24px; font-weight: 700; margin: 0; font-family: Arial, sans-serif; line-height: 1.1; }
  .statement-report-modal-company-arabic-subtitle { font-size: 22px; font-weight: 700; margin: 0; font-family: Arial, sans-serif; line-height: 1.1; }
  .statement-report-modal-company-title { font-size: 24px; font-weight: 400; margin: 0; font-family: Arial, sans-serif; line-height: 1.1; }
  .statement-report-modal-company-subtitle { font-size: 22px; font-weight: 400; margin: 0; font-family: Arial, sans-serif; line-height: 1.1; }
  .statement-report-modal-small-subtitle { margin: 0; font-weight: 400; }
  .statement-report-modal-arabic-contact { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
  .statement-report-modal-arabic-line { display: grid; grid-template-columns: 90px 12px 1fr; align-items: center; }
  .statement-report-modal-arabic-label { text-align: right; }
  .statement-report-modal-arabic-colon { text-align: center; }
  .statement-report-modal-arabic-value { direction: ltr; }

  /* ── Title bar ── */
  .statement-report-modal-titlebar {
    margin: 0 8px 6px 8px; padding: 6px 10px;
    text-align: center; font-weight: 700; font-size: 23px;
  }

  /* ── Client line ── */
  .statement-report-modal-clientline {
    display: grid; grid-template-columns: 80px 12px 1fr;
    align-items: center; padding: 6px 10px; margin: 0 8px 6px 8px;
    border: 1px solid #000; box-sizing: border-box;
    direction: rtl; font-family: Arial, sans-serif; font-size: 15px;
  }
  .statement-report-modal-clientline-label { text-align: right; font-weight: 700; }
  .statement-report-modal-clientline-colon { text-align: center; }
  .statement-report-modal-clientline-value { text-align: right; direction: rtl; font-size: 18px; font-weight: bold; }

  /* ── Info table ── */
  .statement-report-modal-info { width: 80%; margin: 0 8px 6px auto; box-sizing: border-box; }
  .statement-report-modal-info-table { width: 100%; border-collapse: separate; border-spacing: 4px 4px; font-family: Arial, sans-serif; font-size: 15px; direction: rtl; }
  .statement-report-modal-info-table th,
  .statement-report-modal-info-table td { border: 1px solid #000 !important; }
  .statement-report-modal-info-table thead th { background: #f9fafb; padding: 6px 8px; text-align: center; white-space: nowrap; }
  .statement-report-modal-info-table tbody td { padding: 6px 8px; text-align: center; direction: ltr; }

  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1, h2, p { margin: 0; }
</style>
</head>
<body></body>
</html>`);
  doc.close();

  buildFn(doc.body)
    .then(() => execPrint(iframe))
    .catch(() => iframe.remove());
}
