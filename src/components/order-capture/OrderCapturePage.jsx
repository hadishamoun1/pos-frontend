import React, { useRef, useState } from "react";
import { axiosClient } from "../api/axiosClient";
import "./OrderCapturePage.css";

// First step toward "a customer sends a photo of their order on WhatsApp and
// it fills the POS table" — just upload a photo and see exactly what Claude
// reads off it, before any structured item-matching gets built on top.
export default function OrderCapturePage() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChosen = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult("");
    setErr("");
    const url = URL.createObjectURL(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setErr("");
    setResult("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axiosClient.post("/order-capture/analyze-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data?.text || "(No text returned.)");
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to analyze the image.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setResult("");
    setErr("");
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="ocp-page">
      <div className="ocp-header">
        <h1 className="ocp-title">Order Capture — Photo Test</h1>
        <p className="ocp-subtitle">
          Upload a photo of a customer order (handwritten or typed) and see exactly what it reads
          off it — a first step toward auto-filling the POS table from a WhatsApp message.
        </p>
      </div>

      <div className="ocp-body">
        <div className="ocp-upload-col">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChosen}
            hidden
          />

          {previewUrl ? (
            <div className="ocp-preview-wrap">
              <img src={previewUrl} alt="Selected order" className="ocp-preview" />
            </div>
          ) : (
            <div className="ocp-dropzone" onClick={() => fileInputRef.current?.click()}>
              <span className="ocp-dropzone-icon">📷</span>
              <span>Click to choose a photo</span>
            </div>
          )}

          <div className="ocp-actions">
            <button
              type="button"
              className="ocp-btn ocp-btn--ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? "Choose Different Photo" : "Choose Photo"}
            </button>
            <button
              type="button"
              className="ocp-btn ocp-btn--primary"
              onClick={handleAnalyze}
              disabled={!file || loading}
            >
              {loading ? "Analyzing…" : "Analyze"}
            </button>
            {file && (
              <button type="button" className="ocp-btn ocp-btn--ghost" onClick={handleClear} disabled={loading}>
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="ocp-result-col">
          <div className="ocp-result-title">What it read</div>
          {err && <div className="ocp-error">{err}</div>}
          {loading && <div className="ocp-loading">Reading the image…</div>}
          {!loading && !err && (
            <pre className="ocp-result-box">
              {result || "Upload a photo and click Analyze to see the result here."}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
