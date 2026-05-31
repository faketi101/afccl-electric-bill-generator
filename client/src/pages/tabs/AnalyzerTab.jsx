import { useState, useEffect, useMemo } from "react";
import api from "../../api";
import {
  generateInvoicePDF,
  generateMonthlyLegalBillsPDF,
  viewInvoicePDF,
  viewMonthlyLegalBillsPDF,
} from "../../utils/pdfGenerator";
import { downloadFilteredInvoicesXlsx } from "../../utils/xlsxDownload";

const supportsMonthInput = (() => {
  const input = document.createElement("input");
  input.setAttribute("type", "month");
  return input.type === "month";
})();

export default function AnalyzerTab() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [filter, setFilter] = useState("all"); // all | paid | unpaid
  const [generationFilter, setGenerationFilter] = useState("all"); // all | generated | not-generated
  const [monthFilter, setMonthFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState({});
  const [config, setConfig] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [batchCopyType, setBatchCopyType] = useState("customer");
  const [batchWithPaidSeal, setBatchWithPaidSeal] = useState(false);
  const [batchPrintBusy, setBatchPrintBusy] = useState(false);
  const [batchPrintError, setBatchPrintError] = useState("");

  const load = async () => {
    const [inv, c, s, cf] = await Promise.all([
      api.get("/invoices"),
      api.get("/customers"),
      api.get("/settings"),
      api.get("/config"),
    ]);
    setInvoices(inv.data);
    setCustomers(c.data);
    setSettings(s.data);
    setConfig(cf.data);
  };

  useEffect(() => {
    load();
  }, []);

  const monthOptions = useMemo(() => {
    return Array.from(
      new Set(invoices.map((invoice) => invoice.billMonth).filter(Boolean)),
    ).sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  const rows = useMemo(() => {
    if (!monthFilter) {
      return invoices.map((invoice) => ({
        key: invoice._id,
        invoice,
        customer: invoice.customer,
        billMonth: invoice.billMonth,
        generated: true,
      }));
    }

    const invoicesByCustomer = new Map();
    const orphanInvoices = [];

    invoices
      .filter((invoice) => invoice.billMonth === monthFilter)
      .forEach((invoice) => {
        const customerId = invoice.customer?._id;
        if (customerId) {
          invoicesByCustomer.set(customerId, invoice);
        } else {
          orphanInvoices.push(invoice);
        }
      });

    return [
      ...customers.map((customer) => {
        const invoice = invoicesByCustomer.get(customer._id);
        return {
          key: `${monthFilter}-${customer._id}`,
          invoice,
          customer,
          billMonth: monthFilter,
          generated: Boolean(invoice),
        };
      }),
      ...orphanInvoices.map((invoice) => ({
        key: invoice._id,
        invoice,
        customer: invoice.customer,
        billMonth: invoice.billMonth,
        generated: true,
      })),
    ];
  }, [customers, invoices, monthFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const invoice = row.invoice;
      const customer = row.customer || {};

      if (generationFilter === "generated" && !row.generated) return false;
      if (generationFilter === "not-generated" && row.generated) return false;
      if (filter !== "all" && invoice?.status !== filter) return false;
      if (q) {
        const match =
          invoice?.invoiceNo?.toLowerCase().includes(q) ||
          customer.name?.toLowerCase().includes(q) ||
          customer.meterNo?.toLowerCase().includes(q) ||
          customer.address?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [filter, generationFilter, rows, searchQuery]);

  const monthlyGeneratedRows = useMemo(() => {
    if (!monthFilter) return [];

    return rows
      .filter((row) => row.generated && row.invoice)
      .sort((a, b) => {
        const aCustomer = a.customer || a.invoice?.customer || {};
        const bCustomer = b.customer || b.invoice?.customer || {};
        const aKey = aCustomer.meterNo || aCustomer.name || a.invoice.invoiceNo;
        const bKey = bCustomer.meterNo || bCustomer.name || b.invoice.invoiceNo;
        return String(aKey || "").localeCompare(String(bKey || ""), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [monthFilter, rows]);

  const monthlyGeneratedInvoices = useMemo(
    () => monthlyGeneratedRows.map((row) => row.invoice),
    [monthlyGeneratedRows],
  );

  const monthlyMissingRows = useMemo(() => {
    if (!monthFilter) return [];
    return rows.filter((row) => !row.generated && row.customer);
  }, [monthFilter, rows]);

  const monthlyCopyCount =
    monthlyGeneratedInvoices.length * (batchCopyType === "both" ? 2 : 1);
  const monthlyLegalPageCount = Math.ceil(monthlyCopyCount / 3);

  useEffect(() => {
    setPage(1);
  }, [filter, generationFilter, monthFilter, searchQuery, pageSize]);

  useEffect(() => {
    if (!monthFilter && generationFilter === "not-generated") {
      setGenerationFilter("all");
    }
  }, [generationFilter, monthFilter]);

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

  const resetFilters = () => {
    setFilter("all");
    setGenerationFilter("all");
    setMonthFilter("");
    setSearchQuery("");
    setPage(1);
  };

  const handleDownload = (invoice, withSeal = false) => {
    generateInvoicePDF(invoice, settings, withSeal, config);
  };

  const handleView = (invoice, withSeal = false) => {
    viewInvoicePDF(invoice, settings, withSeal, config);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this invoice?")) return;
    await api.delete(`/invoices/${id}`);
    load();
  };

  const handleDownloadXlsx = () => {
    downloadFilteredInvoicesXlsx({
      filter,
      generationFilter,
      monthFilter,
      searchQuery,
      rows: filtered,
      totalPaid,
      totalUnpaid,
    });
  };

  const confirmMissingBills = () => {
    if (monthlyMissingRows.length === 0) return true;

    const previewNames = monthlyMissingRows
      .slice(0, 8)
      .map((row) => row.customer?.name || row.customer?.meterNo || "Unnamed")
      .join(", ");
    const remainingCount = monthlyMissingRows.length - 8;
    const moreText =
      remainingCount > 0 ? `\n...and ${remainingCount} more.` : "";

    return confirm(
      `${monthlyMissingRows.length} customer(s) do not have generated bills for ${monthFilter}.\n${previewNames}${moreText}\n\nContinue with generated bills only?`,
    );
  };

  const handleMonthlyLegalPdf = async (mode) => {
    setBatchPrintError("");

    if (!monthFilter) {
      setBatchPrintError("Select a bill month before creating legal print PDF.");
      return;
    }

    if (monthlyGeneratedInvoices.length === 0) {
      setBatchPrintError("No generated bills found for the selected month.");
      return;
    }

    if (!confirmMissingBills()) return;

    setBatchPrintBusy(true);
    try {
      const options = {
        invoices: monthlyGeneratedInvoices,
        settings,
        config,
        billMonth: monthFilter,
        copyType: batchCopyType,
        withPaidSeal: batchWithPaidSeal,
      };

      if (mode === "download") {
        await generateMonthlyLegalBillsPDF(options);
      } else {
        await viewMonthlyLegalBillsPDF({
          ...options,
          autoPrint: mode === "print",
        });
      }
    } catch (err) {
      setBatchPrintError(
        err?.message || "Could not create the monthly legal print PDF.",
      );
    } finally {
      setBatchPrintBusy(false);
    }
  };

  // Summary stats
  const totalUnpaid = filtered
    .filter((row) => row.invoice?.status === "unpaid")
    .reduce((s, row) => s + Number(row.invoice.totalAmount || 0), 0);
  const totalPaid = filtered
    .filter((row) => row.invoice?.status === "paid")
    .reduce((s, row) => s + Number(row.invoice.totalAmount || 0), 0);
  const generatedCount = filtered.filter((row) => row.generated).length;
  const notGeneratedCount = filtered.length - generatedCount;

  return (
    <div>
      <h2>Bill Analyzer</h2>

      {/* Stats cards */}
      <div className="grid-3 mb-2">
        {[
          { label: "Visible Rows", value: filtered.length, color: "#3182ce" },
          {
            label: "Bill Generated",
            value: generatedCount,
            color: "#805ad5",
          },
          {
            label: "Not Generated",
            value: notGeneratedCount,
            color: "#dd6b20",
          },
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

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <button
          type="button"
          onClick={resetFilters}
          className="btn"
          style={{
            background: "#fff",
            color: "#1a365d",
            border: "1px solid #90cdf4",
            fontWeight: 700,
          }}
        >
          Reset Filters
        </button>
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
          list={supportsMonthInput ? undefined : "bill-month-options"}
          placeholder="YYYY-MM"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          style={{ maxWidth: "180px" }}
        />
        {!supportsMonthInput && (
          <datalist id="bill-month-options">
          {monthOptions.map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
          </datalist>
        )}

        <select
          className="form-input"
          value={generationFilter}
          onChange={(e) => setGenerationFilter(e.target.value)}
          style={{ maxWidth: "190px" }}
        >
          <option value="all">All bills</option>
          <option value="generated">Bill generated</option>
          <option value="not-generated" disabled={!monthFilter}>
            Bill not generated
          </option>
        </select>

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
        className="card mb-2"
        style={{ border: "1px solid #bee3f8", boxShadow: "none" }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div>
            <div className="card-label">Legal Batch Print</div>
            <div
              style={{
                color: "#2d3748",
                fontWeight: 700,
                lineHeight: 1.4,
              }}
            >
              {monthFilter
                ? `${monthlyGeneratedInvoices.length} bills, ${monthlyCopyCount} slips, ${monthlyLegalPageCount} legal pages`
                : "Select a month"}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              gap: "0.75rem",
            }}
          >
            <label style={{ minWidth: "160px" }}>
              <span className="form-label">Month</span>
              <input
                type={supportsMonthInput ? "month" : "text"}
                className="form-input"
                list={supportsMonthInput ? undefined : "bill-month-options"}
                placeholder="YYYY-MM"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              />
            </label>

            <label style={{ minWidth: "160px" }}>
              <span className="form-label">Copy</span>
              <select
                className="form-input"
                value={batchCopyType}
                onChange={(e) => setBatchCopyType(e.target.value)}
              >
                <option value="customer">Customer Copy</option>
                <option value="office">Office Copy</option>
                <option value="both">Both Copies</option>
              </select>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                minHeight: "42px",
                color: "#2d3748",
                fontWeight: 700,
              }}
            >
              <input
                type="checkbox"
                checked={batchWithPaidSeal}
                onChange={(e) => setBatchWithPaidSeal(e.target.checked)}
              />
              Paid seal
            </label>

            <button
              type="button"
              onClick={() => handleMonthlyLegalPdf("print")}
              className="btn btn-primary"
              disabled={batchPrintBusy}
              style={{ background: "#1a365d" }}
            >
              {batchPrintBusy ? "Generating..." : "Print Legal PDF"}
            </button>

            <button
              type="button"
              onClick={() => handleMonthlyLegalPdf("download")}
              className="btn"
              disabled={batchPrintBusy}
              style={{
                background: "#fff",
                color: "#1a365d",
                border: "1px solid #90cdf4",
              }}
            >
              Download Legal PDF
            </button>
          </div>
        </div>

        {monthFilter && monthlyMissingRows.length > 0 && (
          <div
            style={{
              marginTop: "0.9rem",
              padding: "0.75rem",
              borderRadius: "4px",
              border: "1px solid #f6ad55",
              background: "#fffaf0",
              color: "#744210",
              fontWeight: 700,
            }}
          >
            Warning: {monthlyMissingRows.length} customer
            {monthlyMissingRows.length === 1 ? "" : "s"} left to generate for{" "}
            {monthFilter}.
          </div>
        )}

        {batchPrintError && (
          <div
            style={{
              marginTop: "0.9rem",
              padding: "0.75rem",
              borderRadius: "4px",
              border: "1px solid #feb2b2",
              background: "#fff5f5",
              color: "#742a2a",
              fontWeight: 700,
            }}
          >
            {batchPrintError}
          </div>
        )}
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
            {pagedInvoices.map((row) => {
              const inv = row.invoice;
              const customer = row.customer || {};

              return (
              <tr key={row.key}>
                <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                  {inv?.invoiceNo || "-"}
                </td>
                <td>{customer.name || "-"}</td>
                <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                  {customer.meterNo || "-"}
                </td>
                <td>{row.billMonth}</td>
                <td style={{ fontFamily: "monospace", fontWeight: "600" }}>
                  {inv ? `৳ ${inv.totalAmount?.toFixed(2)}` : "-"}
                </td>
                <td>
                  {inv ? (
                    <span
                      className={`status-badge ${inv.status === "paid" ? "status-paid" : "status-unpaid"}`}
                    >
                      {inv.status.toUpperCase()}
                    </span>
                  ) : (
                    <span
                      className="status-badge"
                      style={{ background: "#fed7d7", color: "#742a2a" }}
                    >
                      NOT GENERATED
                    </span>
                  )}
                </td>
                <td style={{ fontSize: "0.8rem" }}>
                  {inv?.paidAt
                    ? new Date(inv.paidAt).toLocaleDateString()
                    : "-"}
                </td>
                <td
                  style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}
                >
                  {inv ? (
                    <>
                      <button
                        onClick={() => handleView(inv, false)}
                        className="btn"
                        style={{
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.75rem",
                          background: "#4a5568",
                          color: "#fff",
                        }}
                      >
                        View
                      </button>
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
                        <>
                          <button
                            onClick={() => handleView(inv, true)}
                            className="btn"
                            style={{
                              padding: "0.25rem 0.5rem",
                              fontSize: "0.75rem",
                              background: "#276749",
                              color: "#fff",
                            }}
                          >
                            Paid View
                          </button>
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
                        </>
                      )}
                      <button
                        onClick={() => toggleStatus(inv)}
                        className="btn"
                        style={{
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.75rem",
                          background:
                            inv.status === "paid" ? "#d69e2e" : "#38a169",
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
                    </>
                  ) : (
                    <span style={{ color: "#a0aec0", fontSize: "0.8rem" }}>
                      No invoice
                    </span>
                  )}
                </td>
              </tr>
              );
            })}
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
