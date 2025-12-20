import React, { useState, useEffect } from "react";
import TransferModal from "./transferModal";
import PreviewTransferTable from "./previewTransferTable";
import NotificationModal from "../recievables/NotificationModal";
import "./TransfersPage.css";

// ✅ use your axios client (named export)
import { axiosClient } from "../api/axiosClient"; // <-- adjust path if needed

export default function TransfersPage() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState(null);
  const [notif, setNotif] = useState({ open: false, type: "", message: "" });

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get("/transfers/v1/details");
      setTransfers(res.data || []);
      setError("");
    } catch (err) {
      console.error("Failed to load transfers", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to load transfers";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const handleCreateNew = () => {
    setEditingTransfer(null);
    setModalOpen(true);
  };

  // ✅ IMPORTANT: ensure itemBatchId exists for edit
  const handleEdit = async (transferFromDetails) => {
    try {
      const id = transferFromDetails?.id;
      if (!id) return;

      // fetch full entity transfer (items contain itemBatchId)
      const fullRes = await axiosClient.get(`/transfers/${id}`);
      const full = fullRes.data;

      const fullItemsById = new Map(
        (full?.items || []).map((it) => [Number(it.id), it])
      );

      // merge itemBatchId into the display-friendly details items
      const mergedItems = (transferFromDetails.items || []).map((it) => {
        const fullIt = fullItemsById.get(Number(it.id));
        return {
          ...it,
          itemBatchId:
            it.itemBatchId ??
            it.batchId ??
            it.itemBatch?.id ??
            fullIt?.itemBatchId,
        };
      });

      const mergedTransfer = {
        ...transferFromDetails,
        ...full,
        items: mergedItems,
      };

      setEditingTransfer(mergedTransfer);
      setModalOpen(true);
    } catch (err) {
      console.error("Failed to load transfer for edit", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Failed to open transfer for edit";
      setNotif({ open: true, type: "error", message: msg });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transfer?")) return;
    try {
      await axiosClient.delete(`/transfers/${id}`);
      setNotif({
        open: true,
        type: "success",
        message: "Transfer deleted successfully!",
      });
      await fetchTransfers();
    } catch (err) {
      console.error("Failed to delete transfer", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err?.message ||
        "Delete failed — please try again.";
      setNotif({
        open: true,
        type: "error",
        message: msg,
      });
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingTransfer(null);
    fetchTransfers();
  };

  const closeNotif = () =>
    setNotif((n) => ({
      ...n,
      open: false,
    }));

  return (
    <div className="transfers-page">
      <div className="transfers-header">
        <h2>Transfers</h2>
        <button className="btn transfers-add-btn" onClick={handleCreateNew}>
          + New Transfer
        </button>
      </div>

      <PreviewTransferTable
        transfers={transfers}
        onEdit={handleEdit}
        onDelete={handleDelete}
        loading={loading}
        error={error}
      />

      {modalOpen && (
        <TransferModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          existingTransfer={editingTransfer}
          isEdit={!!editingTransfer}
        />
      )}

      {notif.open && (
        <NotificationModal
          type={notif.type}
          message={notif.message}
          onClose={closeNotif}
        />
      )}
    </div>
  );
}
