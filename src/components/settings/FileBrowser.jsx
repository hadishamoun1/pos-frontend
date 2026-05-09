import React, { useCallback, useEffect, useRef, useState } from "react";
import { axiosClient } from "../api/axiosClient";
import "./styles/fileBrowser.css";

const API = (path) => `/file-browser${path}`;

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}

function fileIcon(entry) {
  if (entry.isDir) return "📁";
  const ext = entry.name.split(".").pop().toLowerCase();
  if (["xlsx","xls","xlsm","csv"].includes(ext)) return "📊";
  if (["docx","doc","odt","rtf"].includes(ext)) return "📝";
  if (["pptx","ppt"].includes(ext)) return "📑";
  if (["pdf"].includes(ext)) return "📕";
  if (["accdb","mdb"].includes(ext)) return "🗄️";
  return "📄";
}

const FILE_TYPES = [
  { value: "all",    label: "All files" },
  { value: "office", label: "Office (Word / Excel / PPT / Access)" },
  { value: "excel",  label: "Excel / CSV" },
  { value: "word",   label: "Word" },
  { value: "pdf",    label: "PDF" },
  { value: "access", label: "Access (.accdb / .mdb)" },
];

export default function FileBrowser() {
  const [devices, setDevices]         = useState([]);
  const [selectedPc, setSelectedPc]   = useState(null);
  const [mode, setMode]               = useState("browse"); // "browse" | "search"

  // Browse state
  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries]         = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [fileType, setFileType]       = useState("all");
  const [searchResults, setSearchResults] = useState([]);
  const [truncated, setTruncated]     = useState(false);

  const [loading, setLoading]         = useState(false);

  async function deleteDevice(pcId) {
    if (!window.confirm("Remove this offline device?")) return;
    try {
      await axiosClient.delete(`/recording/devices/${encodeURIComponent(pcId)}`);
      setDevices((prev) => prev.filter((d) => d.pcId !== pcId));
      if (selectedPc === pcId) setSelectedPc(null);
    } catch {}
  }
  const [dlLoading, setDlLoading]     = useState(null); // path being downloaded
  const [err, setErr]                 = useState("");

  const pollTimerRef = useRef(null);
  const pendingCmdId = useRef(null);

  // Load registered PCs from recording devices endpoint
  useEffect(() => {
    axiosClient.get("/recording/devices")
      .then(({ data }) => setDevices(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Poll for result after sending a command
  const pollResult = useCallback((pcId, cmdId, onResult) => {
    stopPolling();
    const start = Date.now();
    pollTimerRef.current = setInterval(async () => {
      if (Date.now() - start > 30000) {
        stopPolling();
        setLoading(false);
        setErr("Timeout — no response from PC");
        return;
      }
      try {
        const { data } = await axiosClient.get(API(`/result/${pcId}`));
        if (data && data.commandId === cmdId) {
          stopPolling();
          onResult(data);
        }
      } catch {}
    }, 1500);
  }, [stopPolling]);

  const sendCommand = useCallback(async (type, payload) => {
    if (!selectedPc) return;
    setLoading(true);
    setErr("");
    try {
      const { data } = await axiosClient.post(API(`/command/${selectedPc}`), { type, payload });
      pendingCmdId.current = data.commandId;
      return data.commandId;
    } catch (e) {
      setLoading(false);
      setErr(e?.response?.data?.message || "Failed to send command");
      return null;
    }
  }, [selectedPc]);

  // ── Browse ──────────────────────────────────────────────────────────────────

  const browse = useCallback(async (path) => {
    const cmdId = await sendCommand("browse", { path });
    if (!cmdId) return;

    pollResult(selectedPc, cmdId, (result) => {
      setLoading(false);
      if (result.data.error) { setErr(result.data.error); return; }

      const newPath = result.data.path || path;
      setCurrentPath(newPath);
      setEntries(result.data.entries || []);

      // Build breadcrumbs
      if (!newPath) {
        setBreadcrumbs([]);
      } else {
        const parts = newPath.replace(/\\/g, "/").split("/").filter(Boolean);
        const crumbs = parts.map((part, i) => {
          const fullPath = parts.slice(0, i + 1).join("\\") + (i === 0 ? "\\" : "");
          return { label: part, path: fullPath };
        });
        setBreadcrumbs(crumbs);
      }
    });
  }, [sendCommand, pollResult, selectedPc]);

  // Initial browse when PC selected
  useEffect(() => {
    if (selectedPc && mode === "browse") {
      setEntries([]);
      setBreadcrumbs([]);
      setCurrentPath("");
      browse("");
    }
  }, [selectedPc]); // eslint-disable-line

  // ── Search ──────────────────────────────────────────────────────────────────

  const search = useCallback(async () => {
    const cmdId = await sendCommand("search", {
      startPath:  "C:\\",
      query:      searchQuery,
      fileType,
      maxResults: 300,
    });
    if (!cmdId) return;

    pollResult(selectedPc, cmdId, (result) => {
      setLoading(false);
      setSearchResults(result.data.files || []);
      setTruncated(!!result.data.truncated);
    });
  }, [sendCommand, pollResult, selectedPc, searchQuery, fileType]);

  // ── Download ─────────────────────────────────────────────────────────────────

  const download = useCallback(async (filePath, filename) => {
    setDlLoading(filePath);
    setErr("");
    try {
      const { data } = await axiosClient.post(API(`/command/${selectedPc}`), {
        type: "download", payload: { path: filePath },
      });
      const cmdId = data.commandId;

      // Poll until download_ready
      const start = Date.now();
      const timer = setInterval(async () => {
        if (Date.now() - start > 60000) {
          clearInterval(timer);
          setDlLoading(null);
          setErr("Download timeout");
          return;
        }
        try {
          const { data: res } = await axiosClient.get(API(`/result/${selectedPc}`));
          if (res && res.commandId === cmdId) {
            clearInterval(timer);
            if (res.data.type === "download_error") {
              setErr(res.data.error || "Download failed");
              setDlLoading(null);
              return;
            }
            if (res.data.type === "download_ready") {
              // Trigger browser download
              const token = sessionStorage.getItem("token");
              const a = document.createElement("a");
              a.href = `/api/file-browser/download/${selectedPc}`;
              // Use fetch to include auth header
              fetch(`/api/file-browser/download/${selectedPc}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
                .then((r) => r.blob())
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  a.href = url;
                  a.download = filename;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 5000);
                })
                .catch(() => setErr("Failed to download file"));
              setDlLoading(null);
            }
          }
        } catch {}
      }, 1500);
    } catch (e) {
      setDlLoading(null);
      setErr(e?.response?.data?.message || "Failed to start download");
    }
  }, [selectedPc]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="fb-wrap">
      <div className="fb-header">
        <div>
          <h2 className="fb-title">File Browser</h2>
          <p className="fb-subtitle">Browse and download files from company PCs</p>
        </div>
      </div>

      {/* PC selector */}
      <div className="fb-pc-bar">
        <label className="fb-label">Select PC</label>
        <div className="fb-pc-list">
          {devices.length === 0 && <span className="fb-muted">No PCs registered</span>}
          {devices.map((d) => (
            <div key={d.pcId} className="fb-pc-item">
              <button
                className={`fb-pc-btn ${selectedPc === d.pcId ? "active" : ""} ${!d.online ? "offline" : ""}`}
                onClick={() => {
                  stopPolling();
                  setSelectedPc(d.pcId);
                  setEntries([]);
                  setSearchResults([]);
                  setErr("");
                }}
              >
                <span className={`fb-dot ${d.online ? "online" : "offline"}`} />
                {d.pcName}
              </button>
              {!d.online && (
                <button className="fb-remove-btn" onClick={() => deleteDevice(d.pcId)} title="Remove device">✕</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedPc && (
        <>
          {/* Mode tabs */}
          <div className="fb-mode-tabs">
            <button className={`fb-mode-tab ${mode === "browse" ? "active" : ""}`}
              onClick={() => { setMode("browse"); setErr(""); browse(currentPath); }}>
              📂 Browse
            </button>
            <button className={`fb-mode-tab ${mode === "search" ? "active" : ""}`}
              onClick={() => { setMode("search"); setErr(""); }}>
              🔍 Search
            </button>
          </div>

          {err && <div className="fb-error">{err}</div>}

          {/* ── Browse mode ── */}
          {mode === "browse" && (
            <div className="fb-browse-panel">
              {/* Breadcrumbs */}
              <div className="fb-breadcrumbs">
                <button className="fb-crumb" onClick={() => browse("")}>🖥 Drives</button>
                {breadcrumbs.map((c, i) => (
                  <React.Fragment key={i}>
                    <span className="fb-crumb-sep">›</span>
                    <button className="fb-crumb" onClick={() => browse(c.path)}>{c.label}</button>
                  </React.Fragment>
                ))}
              </div>

              {loading ? (
                <div className="fb-loading">Loading…</div>
              ) : (
                <table className="fb-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Size</th>
                      <th>Modified</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 && (
                      <tr><td colSpan={4} className="fb-empty">Empty folder</td></tr>
                    )}
                    {entries.map((entry, i) => (
                      <tr key={i} className={entry.isDir ? "fb-row-dir" : "fb-row-file"}>
                        <td>
                          <button
                            className="fb-name-btn"
                            onClick={() => entry.isDir ? browse(entry.path) : download(entry.path, entry.name)}
                          >
                            {fileIcon(entry)} {entry.name}
                          </button>
                        </td>
                        <td className="fb-size">{entry.isDir ? "—" : formatSize(entry.size)}</td>
                        <td className="fb-date">{formatDate(entry.modified)}</td>
                        <td>
                          {!entry.isDir && (
                            <button
                              className="fb-dl-btn"
                              disabled={dlLoading === entry.path}
                              onClick={() => download(entry.path, entry.name)}
                            >
                              {dlLoading === entry.path ? "⏳" : "⬇ Download"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Search mode ── */}
          {mode === "search" && (
            <div className="fb-search-panel">
              <div className="fb-search-bar">
                <input
                  className="fb-search-input"
                  type="text"
                  placeholder="File name keyword (leave blank for all)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                />
                <select className="fb-type-select" value={fileType} onChange={(e) => setFileType(e.target.value)}>
                  {FILE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <button className="fb-search-btn" onClick={search} disabled={loading}>
                  {loading ? "Searching…" : "Search"}
                </button>
              </div>

              {truncated && (
                <div className="fb-warn">Showing first 300 results — refine your search to narrow down</div>
              )}

              {searchResults.length > 0 && (
                <table className="fb-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Path</th>
                      <th>Size</th>
                      <th>Modified</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((f, i) => (
                      <tr key={i} className="fb-row-file">
                        <td>
                          <span className="fb-file-name">{fileIcon(f)} {f.name}</span>
                        </td>
                        <td className="fb-path">{f.path}</td>
                        <td className="fb-size">{formatSize(f.size)}</td>
                        <td className="fb-date">{formatDate(f.modified)}</td>
                        <td>
                          <button
                            className="fb-dl-btn"
                            disabled={dlLoading === f.path}
                            onClick={() => download(f.path, f.name)}
                          >
                            {dlLoading === f.path ? "⏳" : "⬇ Download"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!loading && searchResults.length === 0 && (
                <div className="fb-empty-search">Run a search to see results</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
