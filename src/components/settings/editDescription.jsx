import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles/editDescription.css";

const PAGE_SIZE = 30;

const DescriptionEditor = () => {
const RAW_API_BASE = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

const apiUrl = (path) => {
  const u = new URL(path, window.location.origin); // always absolute
  if (RAW_API_BASE) u.pathname = `${RAW_API_BASE}${u.pathname}`.replace(/\/{2,}/g, "/");
  return u;
};

  // Mode
  const [mode, setMode] = useState("name"); // "name" | "real"

  // Search state
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);

  // Selection + form
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    itemNumber: "",
    categoryName: "",
    subCategory: "",
    colorName: "",
    designName: "",
  });
  const [onDuplicate, setOnDuplicate] = useState("error"); // "error" | "merge"

  // UX state
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { ok: boolean, message: string }

  // Debounced search
  const debounceRef = useRef(null);
  const fetchList = async (reset = true, pageArg) => {
    const p = reset ? 1 : (pageArg ?? page);
    setLoading(true);
    try {
const url = apiUrl("/items/descriptions/search");
      url.searchParams.set("mode", mode);
      url.searchParams.set("q", query || "");
      url.searchParams.set("page", String(p));
      url.searchParams.set("limit", String(PAGE_SIZE));
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Search failed");
      const json = await res.json();
      if (reset) {
        setResults(Array.isArray(json?.data) ? json.data : []);
        setPage(1);
      } else {
        setResults((prev) => [...prev, ...(Array.isArray(json?.data) ? json.data : [])]);
        setPage(p);
      }
      setTotal(Number(json?.total ?? 0));
    } catch (e) {
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchList(true), 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, query, baseUrl]);

  // Load selection into form
  const pickRow = (row) => {
    setSelected(row);
    setForm({
      itemNumber: row.itemNumber || "",
      categoryName: row.categoryName || "",
      subCategory: row.subCategory || "",
      colorName: row.colorName || "",
      designName: row.designName || "",
    });
    setStatus(null);
  };

  // Dirty check
  const isDirty = useMemo(() => {
    if (!selected) return false;
    return (
      (form.itemNumber ?? "")   !== (selected.itemNumber ?? "") ||
      (form.categoryName ?? "") !== (selected.categoryName ?? "") ||
      (form.subCategory ?? "")  !== (selected.subCategory ?? "") ||
      (form.colorName ?? "")    !== (selected.colorName ?? "") ||
      (form.designName ?? "")   !== (selected.designName ?? "")
    );
  }, [form, selected]);

  const canSave = !!selected && isDirty && !saving;

  // Save
  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setStatus(null);
    try {
 const endpoint =
  mode === "name"
    ? apiUrl(`/items/descriptions/name/${encodeURIComponent(selected.id)}`).toString()
    : apiUrl(`/items/descriptions/real/${encodeURIComponent(selected.id)}`).toString();


      const body = {
        ...Object.fromEntries(
          Object.entries(form).filter(([_, v]) => v !== undefined) // partial update ok
        ),
        onDuplicate,
      };

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "Update failed");
      }
      const json = text ? JSON.parse(text) : null;

      // Update local selection + list row
      setSelected(json);
      setForm({
        itemNumber: json?.itemNumber || "",
        categoryName: json?.categoryName || "",
        subCategory: json?.subCategory || "",
        colorName: json?.colorName || "",
        designName: json?.designName || "",
      });

      setResults((prev) =>
        prev.map((r) => (Number(r.id) === Number(selected.id) ? json : r))
      );

      setStatus({ ok: true, message: onDuplicate === "merge" ? "Updated (merged if duplicate existed)." : "Updated." });
    } catch (e) {
      setStatus({ ok: false, message: String(e.message || e) });
    } finally {
      setSaving(false);
    }
  };

  // Helpers
  const rowToText = (d) =>
    [d.itemNumber, d.categoryName, d.subCategory, d.colorName, d.designName]
      .filter(Boolean)
      .join(" • ");

  const hasMore = results.length < total;

  return (
    <div className="de-page">
      <div className="de-header">
        <h1>Description Editor</h1>
        <p className="de-sub">
          Search a description, switch side (<b>Item-Name</b> / <b>Real</b>), edit fields, and choose how to handle duplicates.
        </p>
      </div>

      <div className="de-grid">
        {/* Left: list */}
        <section className="de-panel">
          <div className="de-panel-title">1) Find a Description</div>

          <div className="de-toolbar">
            <div className="de-toggle">
              <label className="toggle-pill">
                <input
                  type="checkbox"
                  checked={mode === "real"}
                  onChange={(e) => {
                    setMode(e.target.checked ? "real" : "name");
                    setSelected(null);
                    setForm({
                      itemNumber: "",
                      categoryName: "",
                      subCategory: "",
                      colorName: "",
                      designName: "",
                    });
                  }}
                />
                <span className="pill">
                  {mode === "real" ? "Editing: Real descriptions" : "Editing: Item-Name descriptions"}
                </span>
              </label>
            </div>

            <div className="de-search">
              <input
                type="text"
                placeholder={`Search ${mode === "real" ? "Real" : "Item-Name"} descriptions…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="ar-rtl"
              />
              <button className="de-btn" onClick={() => fetchList(true)}>Search</button>
            </div>
          </div>

          <div className="de-list">
            {loading && results.length === 0 ? (
              <div className="de-empty">Searching…</div>
            ) : results.length === 0 ? (
              <div className="de-empty">No descriptions found.</div>
            ) : (
              results.map((r) => (
                <button
                  type="button"
                  key={`row-${r.id}`}
                  className={`de-row ${selected?.id === r.id ? "active" : ""}`}
                  onClick={() => pickRow(r)}
                  title="Select description"
                >
                  <div className="de-row-main ar-rtl">{rowToText(r)}</div>
                  <div className="de-row-sub">ID: {r.id}</div>
                </button>
              ))
            )}
          </div>

          <div className="de-footer">
            {hasMore ? (
              <button
                className="de-btn de-btn-pill"
                disabled={loading}
                onClick={() => fetchList(false, page + 1)}
              >
                {loading ? "Loading…" : "Load More"}
              </button>
            ) : (
              <button className="de-btn de-btn-pill" disabled>
                {results.length}/{total} loaded
              </button>
            )}
          </div>
        </section>

        {/* Right: editor */}
        <section className="de-panel">
          <div className="de-panel-title">2) Edit Fields</div>

          {!selected ? (
            <div className="de-empty">Pick a description from the left to edit.</div>
          ) : (
            <>
              <div className="de-selected">
                <div className="de-selected-title">Selected</div>
                <div className="de-selected-body ar-rtl">{rowToText(selected)}</div>
              </div>

              <div className="de-form-grid">
                <label>
                  <span>Item Number</span>
                  <input
                    type="text"
                    className="ltr"
                    value={form.itemNumber}
                    onChange={(e) => setForm((p) => ({ ...p, itemNumber: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Category</span>
                  <input
                    type="text"
                    className="ar-rtl"
                    value={form.categoryName}
                    onChange={(e) => setForm((p) => ({ ...p, categoryName: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Subcategory</span>
                  <input
                    type="text"
                    className="ar-rtl"
                    value={form.subCategory}
                    onChange={(e) => setForm((p) => ({ ...p, subCategory: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Color</span>
                  <input
                    type="text"
                    className="ar-rtl"
                    value={form.colorName}
                    onChange={(e) => setForm((p) => ({ ...p, colorName: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Design</span>
                  <input
                    type="text"
                    className="ar-rtl"
                    value={form.designName}
                    onChange={(e) => setForm((p) => ({ ...p, designName: e.target.value }))}
                  />
                </label>
              </div>

              <div className="de-dup">
                <div className="de-dup-title">When duplicate exists:</div>
                <label className="de-radio">
                  <input
                    type="radio"
                    name="dup"
                    value="error"
                    checked={onDuplicate === "error"}
                    onChange={() => setOnDuplicate("error")}
                  />
                  <span>Error (don’t change)</span>
                </label>
                <label className="de-radio">
                  <input
                    type="radio"
                    name="dup"
                    value="merge"
                    checked={onDuplicate === "merge"}
                    onChange={() => setOnDuplicate("merge")}
                  />
                  <span>Merge (relink variants to existing, delete this)</span>
                </label>
              </div>

              <div className="de-actions">
                <button
                  className="de-btn de-btn-dark"
                  disabled={!canSave}
                  onClick={handleSave}
                  title={canSave ? "Save changes" : "No changes to save"}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                {status && (
                  <span className={`de-status ${status.ok ? "de-ok" : "de-err"}`}>{status.message}</span>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default DescriptionEditor;
