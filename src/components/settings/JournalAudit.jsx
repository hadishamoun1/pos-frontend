import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { axiosClient } from "../api/axiosClient";
import "./InvoiceTypeConverter.css";
import "./JournalAudit.css";

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => (d ? String(d).slice(0, 10) : "—");

export default function JournalAudit() {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString().slice(0, 10);
  const defaultTo = today.toISOString().slice(0, 10);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [scanAll, setScanAll] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleScan = useCallback(async () => {
    setErr("");
    setData(null);
    setLoading(true);
    try {
      const params = scanAll ? {} : { from, to };
      const res = await axiosClient.get("/journal-vouchers/v1/audit", { params });
      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to scan.");
    } finally {
      setLoading(false);
    }
  }, [from, to, scanAll]);

  const duplicateCount = data?.duplicateGroups?.length ?? 0;
  const unbalancedCount = data?.unbalancedVouchers?.length ?? 0;
  const duplicateVoucherCount = data?.duplicateVouchers?.length ?? 0;
  const isClean = data && duplicateCount === 0 && unbalancedCount === 0 && duplicateVoucherCount === 0;

  return (
    <div className="itc-page ja-page">
      <div className="itc-header">
        <h1 className="itc-title">Journal Audit</h1>
        <p className="itc-subtitle">
          Catches double-posting fast, in either shape it can take: the same content duplicated <em>inside</em> one
          voucher, or saved as two entirely <em>separate</em> voucher records. Both still net "balanced" in the
          totals, so they're easy to miss just eyeballing them — a voucher is only flagged when every one of its
          lines repeats the same number of times, not just a couple of lines that happen to share an amount inside a
          larger batch, which is normal and not an error. Also separately checks for vouchers that don't balance at
          all.
        </p>
      </div>

      <section className="itc-section">
        <div className="itc-section-title">Scan Range</div>
        <div className="itc-filters">
          <div className="itc-field">
            <label>From</label>
            <input
              type="date"
              className="itc-input"
              value={from}
              disabled={scanAll}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="itc-field">
            <label>To</label>
            <input
              type="date"
              className="itc-input"
              value={to}
              disabled={scanAll}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="itc-field">
            <label>&nbsp;</label>
            <label className="ja-checkbox-label">
              <input type="checkbox" checked={scanAll} onChange={(e) => setScanAll(e.target.checked)} />
              Scan everything (ignore date range)
            </label>
          </div>
          <div className="itc-field itc-field-btn">
            <button type="button" className="itc-btn itc-btn-primary" onClick={handleScan} disabled={loading}>
              {loading ? "Scanning…" : "Scan"}
            </button>
          </div>
        </div>
        {err && <div className="itc-error">{err}</div>}
      </section>

      {data && (
        <>
          <section className="itc-section">
            <div className={`itc-result ${isClean ? "itc-result-ok" : "itc-result-warn"}`}>
              Scanned {data.scannedVouchers} voucher{data.scannedVouchers === 1 ? "" : "s"} —{" "}
              {isClean ? (
                "nothing wrong found."
              ) : (
                <>
                  <strong>{duplicateCount}</strong> duplicate-line group{duplicateCount === 1 ? "" : "s"},{" "}
                  <strong>{duplicateVoucherCount}</strong> duplicate voucher pair{duplicateVoucherCount === 1 ? "" : "s"},{" "}
                  <strong>{unbalancedCount}</strong> unbalanced voucher{unbalancedCount === 1 ? "" : "s"}.
                </>
              )}
            </div>
          </section>

          <section className="itc-section">
            <div className="itc-section-title">
              Duplicate Lines
              <span className={`itc-badge ${duplicateCount ? "ja-badge-bad" : "itc-badge-green"}`}>
                {duplicateCount}
              </span>
            </div>
            {duplicateCount === 0 ? (
              <p className="ja-empty">No duplicate lines found.</p>
            ) : (
              <div className="itc-table-wrap">
                <table className="itc-table">
                  <thead>
                    <tr>
                      <th>JV Number</th>
                      <th>Date</th>
                      <th>Doc #</th>
                      <th>Account</th>
                      <th>Description</th>
                      <th className="num">DR</th>
                      <th className="num">CR</th>
                      <th className="num">Times Posted</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.duplicateGroups.map((g, i) => (
                      <tr key={i} className="ja-row-bad">
                        <td className="itc-inv-num">{g.jvNumber}</td>
                        <td>{fmtDate(g.date)}</td>
                        <td>{g.docNbr}</td>
                        <td>
                          {g.accountNumber} — {g.accountName}
                        </td>
                        <td className="itc-dim">{g.description}</td>
                        <td className="num">{fmt(g.dr)}</td>
                        <td className="num">{fmt(g.cr)}</td>
                        <td className="num">
                          <span className="ja-badge-bad itc-badge">×{g.occurrences}</span>
                        </td>
                        <td>
                          <Link to={`/journal-voucher/${g.journalVoucherId}`} className="ja-link">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="itc-section">
            <div className="itc-section-title">
              Duplicate Vouchers
              <span className={`itc-badge ${duplicateVoucherCount ? "ja-badge-bad" : "itc-badge-green"}`}>
                {duplicateVoucherCount}
              </span>
            </div>
            <p className="ja-empty" style={{ marginBottom: duplicateVoucherCount ? 10 : 0 }}>
              Two or more completely separate voucher records with the same date and identical lines — the whole
              thing saved twice as different vouchers, not just duplicated inside one.
            </p>
            {duplicateVoucherCount === 0 ? null : (
              <div className="itc-table-wrap">
                <table className="itc-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="num">Lines</th>
                      <th>Voucher Numbers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.duplicateVouchers.map((g, i) => (
                      <tr key={i} className="ja-row-bad">
                        <td>{fmtDate(g.date)}</td>
                        <td className="num">{g.lineCount}</td>
                        <td>
                          {g.vouchers.map((v, j) => (
                            <React.Fragment key={v.journalVoucherId}>
                              {j > 0 && ", "}
                              <Link to={`/journal-voucher/${v.journalVoucherId}`} className="ja-link">
                                {v.jvNumber}
                              </Link>
                            </React.Fragment>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="itc-section">
            <div className="itc-section-title">
              Unbalanced Vouchers
              <span className={`itc-badge ${unbalancedCount ? "ja-badge-bad" : "itc-badge-green"}`}>
                {unbalancedCount}
              </span>
            </div>
            {unbalancedCount === 0 ? (
              <p className="ja-empty">Every voucher's debits and credits match.</p>
            ) : (
              <div className="itc-table-wrap">
                <table className="itc-table">
                  <thead>
                    <tr>
                      <th>JV Number</th>
                      <th>Date</th>
                      <th className="num">Lines</th>
                      <th className="num">Total DR (USD)</th>
                      <th className="num">Total CR (USD)</th>
                      <th className="num">Difference</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.unbalancedVouchers.map((v) => (
                      <tr key={v.journalVoucherId} className="ja-row-bad">
                        <td className="itc-inv-num">{v.jvNumber}</td>
                        <td>{fmtDate(v.date)}</td>
                        <td className="num">{v.lineCount}</td>
                        <td className="num">{fmt(v.totalDrUSD)}</td>
                        <td className="num">{fmt(v.totalCrUSD)}</td>
                        <td className="num ja-diff">{fmt(v.difference)}</td>
                        <td>
                          <Link to={`/journal-voucher/${v.journalVoucherId}`} className="ja-link">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
