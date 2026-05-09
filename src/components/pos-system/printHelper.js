const ID = '__revo_print__';

export function printHtml(htmlContent) {
  document.getElementById(ID)?.remove();
  document.getElementById(`${ID}_iso`)?.remove();

  const container = document.createElement('div');
  container.id = ID;
  container.style.display = 'none';
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  const iso = document.createElement('style');
  iso.id = `${ID}_iso`;
  iso.textContent = `@media print { body > * { display:none!important; } #${ID} { display:block!important; } }`;
  document.head.appendChild(iso);

  window.addEventListener('afterprint', () => {
    document.getElementById(ID)?.remove();
    document.getElementById(`${ID}_iso`)?.remove();
  }, { once: true });

  window.print();
}

export function printWithDomBuilder(buildFn) {
  document.getElementById(ID)?.remove();
  document.getElementById(`${ID}_iso`)?.remove();
  document.getElementById(`${ID}_page_style`)?.remove();

  const pageStyle = document.createElement('style');
  pageStyle.id = `${ID}_page_style`;
  pageStyle.textContent = `
    @page { size: A4 portrait; margin: 10mm; }
    #${ID} { position: absolute; left: -9999px; top: 0; }
    #${ID} .print-page { position: relative; width: 190mm; height: 277mm; display: flex; flex-direction: column; box-sizing: border-box; page-break-after: always; overflow: hidden; }
    #${ID} .print-page:last-child { page-break-after: auto; }
    #${ID} .page-header { flex: 0 0 auto; }
    #${ID} .page-body { flex: 1 1 auto; display: flex; flex-direction: column; }
    #${ID} .statement-report-modal-a4 { width: 190mm; margin: 0; padding: 0; box-shadow: none; border: 0; }
    #${ID} .statement-report-modal-table { width: 100%; border-collapse: collapse; table-layout: fixed; border-spacing: 0; }
    #${ID} .statement-report-modal-table th, #${ID} .statement-report-modal-table td { border: 1px solid #000; padding: 6px 8px; font-size: 13px; line-height: 1.2; }
    #${ID} .statement-report-modal-table thead th { position: static !important; background: #f3f4f6; }
    #${ID} .statement-report-modal-table tr { break-inside: avoid; page-break-inside: avoid; }
    #${ID} .statement-report-modal-footer-row td { font-weight: 700; }
    #${ID} .statement-report-modal-footer-row td.footer-spacer { border: none !important; background: transparent !important; }
    #${ID} .statement-report-modal-footer-row td.footer-label { border-left: none !important; }
    #${ID} .statement-report-modal-footer-row td.footer-label, #${ID} .statement-report-modal-footer-row td.footer-amount { font-size: 16px; line-height: 1.25; font-weight: 700; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h1, h2, p { margin: 0; }
  `;
  document.head.appendChild(pageStyle);

  const container = document.createElement('div');
  container.id = ID;
  document.body.appendChild(container);

  const iso = document.createElement('style');
  iso.id = `${ID}_iso`;
  iso.textContent = `@media print { body > * { display:none!important; } #${ID} { display:block!important; position:static!important; left:0!important; } }`;
  document.head.appendChild(iso);

  const cleanup = () => {
    document.getElementById(ID)?.remove();
    document.getElementById(`${ID}_iso`)?.remove();
    document.getElementById(`${ID}_page_style`)?.remove();
  };

  buildFn(container).then(() => {
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  }).catch(cleanup);
}
