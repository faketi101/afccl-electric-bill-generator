import { useState, useEffect, useMemo } from "react";
import api from "../../api";
import { generateInvoicePDF } from "../../utils/pdfGenerator";
import { downloadFilteredInvoicesXlsx } from "../../utils/xlsxDownload";

const supportsMonthInput = (() => {
  const input = document.createElement("input");
  input.setAttribute("type", "month");
  return input.type === "month";
})();

export default function AnalyzerTab() {
  const [invoices, setInvoices] = useState([]);
  const [filter, setFilter] = useState("all"); // all | paid | unpaid
  const [monthFilter, setMonthFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const load = async () => {
    const [inv, s] = await Promise.all([
      api.get("/invoices"),
      api.get("/settings"),
    ]);
    setInvoices(inv.data);
    setSettings(s.data);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((i) => {
      if (filter !== "all" && i.status !== filter) return false;
      if (monthFilter && i.billMonth !== monthFilter) return false;
      if (q) {
        const match =
          i.invoiceNo?.toLowerCase().includes(q) ||
          i.customer?.name?.toLowerCase().includes(q) ||
          i.customer?.meterNo?.toLowerCase().includes(q) ||
          i.customer?.address?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [invoices, filter, monthFilter, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [filter, monthFilter, searchQuery, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageStart = (page - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const pagedInvoices = filtered.slice(pageStart, pageEnd);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = new Set([1, totalPages, page - 1, page, page + 1]);
    const ordered = Array.from(pages)
      .filter((p) => p >= 1 && p <= totalPages)
      .sort((a, b) => a - b);
    const output = [];

    for (let i = 0; i < ordered.length; i += 1) {
      if (i > 0 && ordered[i] - ordered[i - 1] > 1) {
        output.push("...");
      }
      output.push(ordered[i]);
    }

    return output;
  }, [page, totalPages]);

  const toggleStatus = async (inv) => {
    const newStatus = inv.status === "paid" ? "unpaid" : "paid";
    await api.patch(`/invoices/${inv._id}/status`, { status: newStatus });
    load();
  };

  const handleDownload = (invoice, withSeal = false) => {
    generateInvoicePDF(invoice, settings, withSeal);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this invoice?")) return;
    await api.delete(`/invoices/${id}`);
    load();
  };

  const handleDownloadXlsx = () => {
    downloadFilteredInvoicesXlsx({
      filter,
      monthFilter,
      searchQuery,
      rows: filtered,
      totalPaid,
      totalUnpaid,
    });
  };

  // Summary stats
  const totalUnpaid = filtered
    .filter((i) => i.status === "unpaid")
    .reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = filtered
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div>
      <h2>Bill Analyzer</h2>

      {/* Stats cards */}
      <div className="grid-3 mb-2">
        {[
          { label: "Total Invoices", value: filtered.length, color: "#3182ce" },
          {
            label: "Paid (BDT)",
            value: `৳ ${totalPaid.toFixed(2)}`,
            color: "#38a169",
          },
          {
            label: "Unpaid (BDT)",
            value: `৳ ${totalUnpaid.toFixed(2)}`,
            color: "#e53e3e",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="card card-border-left"
            style={{ borderLeftColor: s.color }}
          >
            <div className="card-label">{s.label}</div>
            <div className="card-value" style={{ color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filter and Search */}
      <div className="flex-wrap mb-2">
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {["all", "paid", "unpaid"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-pill ${filter === f ? "btn-primary" : ""}`}
              style={
                filter === f
                  ? {}
                  : {
                      background: "#fff",
                      color: "#4a5568",
                      border: "1px solid #e2e8f0",
                    }
              }
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <input
          type={supportsMonthInput ? "month" : "text"}
          className="form-input"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          inputMode="numeric"
          placeholder="YYYY-MM"
          pattern="\\d{4}-\\d{2}"
          title="Use YYYY-MM format"
          style={{ maxWidth: "150px" }}
        />

        <input
          type="text"
          className="search-input"
          placeholder="Search Invoice, Name, Meter, Address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <button
          type="button"
          onClick={handleDownloadXlsx}
          className="btn btn-primary"
          style={{ background: "#2b6cb0" }}
        >
          Download XLSX
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <div style={{ fontSize: "0.85rem", color: "#4a5568" }}>
          Showing {filtered.length ? pageStart + 1 : 0}-{pageEnd} of{" "}
          {filtered.length}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#4a5568" }}>Rows</span>
          <select
            className="form-input"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={{ maxWidth: "110px" }}
          >
            {[25, 50, 100, 200, 500].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.85rem", color: "#4a5568" }}>
            Page {page} of {totalPages}
          </span>
          {pageNumbers.map((p, index) =>
            p === "..." ? (
              <span
                key={`gap-${index}`}
                style={{ padding: "0.3rem 0.4rem", color: "#a0aec0" }}
              >
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`btn ${p === page ? "btn-primary" : ""}`}
                onClick={() => setPage(p)}
                style={{ padding: "0.3rem 0.6rem" }}
              >
                {p}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Table */}
      <div
        className="table-responsive"
        style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}
      >
        <table style={{ minWidth: "900px" }}>
          <thead>
            <tr>
              {[
                "Invoice No",
                "Customer",
                "Meter",
                "Month",
                "Total (BDT)",
                "Status",
                "Paid Date",
                "Actions",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedInvoices.map((inv) => (
              <tr key={inv._id}>
                <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                  {inv.invoiceNo}
                </td>
                <td>{inv.customer?.name}</td>
                <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                  {inv.customer?.meterNo}
                </td>
                <td>{inv.billMonth}</td>
                <td style={{ fontFamily: "monospace", fontWeight: "600" }}>
                  ৳ {inv.totalAmount?.toFixed(2)}
                </td>
                <td>
                  <span
                    className={`status-badge ${inv.status === "paid" ? "status-paid" : "status-unpaid"}`}
                  >
                    {inv.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ fontSize: "0.8rem" }}>
                  {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "-"}
                </td>
                <td
                  style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}
                >
                  <button
                    onClick={() => handleDownload(inv, false)}
                    className="btn"
                    style={{
                      padding: "0.25rem 0.5rem",
                      fontSize: "0.75rem",
                      background: "#3182ce",
                      color: "#fff",
                    }}
                  >
                    PDF
                  </button>
                  {inv.status === "paid" && (
                    <button
                      onClick={() => handleDownload(inv, true)}
                      className="btn"
                      style={{
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.75rem",
                        background: "#2f855a",
                        color: "#fff",
                      }}
                    >
                      PAID PDF
                    </button>
                  )}
                  <button
                    onClick={() => toggleStatus(inv)}
                    className="btn"
                    style={{
                      padding: "0.25rem 0.5rem",
                      fontSize: "0.75rem",
                      background: inv.status === "paid" ? "#d69e2e" : "#38a169",
                      color: "#fff",
                    }}
                  >
                    {inv.status === "paid" ? "Unpaid" : "Mark Paid"}
                  </button>
                  <button
                    onClick={() => handleDelete(inv._id)}
                    className="btn"
                    style={{
                      padding: "0.25rem 0.5rem",
                      fontSize: "0.75rem",
                      background: "#e53e3e",
                      color: "#fff",
                    }}
                  >
                    Del
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: "2rem",
                    textAlign: "center",
                    color: "#a0aec0",
                  }}
                >
                  No invoices found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
