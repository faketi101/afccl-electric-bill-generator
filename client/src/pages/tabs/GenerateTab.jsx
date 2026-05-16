import { useState, useEffect } from "react";
import api from "../../api";
import { generateInvoicePDF } from "../../utils/pdfGenerator";

const supportsMonthInput = (() => {
  const input = document.createElement("input");
  input.setAttribute("type", "month");
  return input.type === "month";
})();

export default function GenerateTab() {
  const [customers, setCustomers] = useState([]);
  const [config, setConfig] = useState({});
  const [settings, setSettings] = useState({});
  const [form, setForm] = useState({
    customerId: "",
    billMonth: "",
    previousReading: "",
    currentReading: "",
    fine: 0,
    fineNote: "",
    dueDate: "",
  });
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");
  const [customerSearch, setCustomerSearch] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/customers"),
      api.get("/config"),
      api.get("/settings"),
    ]).then(([c, cf, s]) => {
      setCustomers(c.data);
      setConfig(cf.data);
      setSettings(s.data);
    });
  }, []);

  // Live calculation preview
  useEffect(() => {
    if (!form.previousReading || !form.currentReading || !config.ratePerUnit)
      return;
    const units = Number(form.currentReading) - Number(form.previousReading);
    if (units < 0) return;
    const unitCharge = units * config.ratePerUnit;
    const subtotal =
      unitCharge + Number(config.serviceCharge || 0) + Number(form.fine || 0);
    const vatAmount = (subtotal * (config.vatPercent || 0)) / 100;
    const total = subtotal + vatAmount;
    setPreview({ units, unitCharge, vatAmount, total });
  }, [form.previousReading, form.currentReading, form.fine, config]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/invoices", {
        customer: form.customerId,
        billMonth: form.billMonth,
        previousReading: Number(form.previousReading),
        currentReading: Number(form.currentReading),
        ratePerUnit: config.ratePerUnit,
        serviceCharge: config.serviceCharge || 0,
        vatPercent: config.vatPercent || 0,
        fine: Number(form.fine || 0),
        fineNote: form.fineNote,
        dueDate: form.dueDate || null,
      });
      setMsg(`Invoice ${res.data.invoiceNo} created!`);
      setMsgType("success");

      // Auto-download PDF
      generateInvoicePDF(res.data, settings);

      setForm({
        customerId: "",
        billMonth: "",
        previousReading: "",
        currentReading: "",
        fine: 0,
        fineNote: "",
        dueDate: "",
      });
      setCustomerSearch("");
      setPreview(null);
    } catch (err) {
      if (err.response?.status === 409) {
        setMsgType("warning");
        setMsg(
          err.response?.data?.message ||
            "Invoice already exists for this customer and month",
        );
        return;
      }
      setMsgType("error");
      setMsg(err.response?.data?.message || "Error creating invoice");
    }
  };

  return (
    <div className="grid-2">
      <div>
        <h2>Generate New Bill</h2>
        <form onSubmit={handleSubmit} className="form">
          {msg && (
            <p
              className={
                msgType === "warning"
                  ? "message message-warning"
                  : msgType === "error"
                    ? "message message-error"
                    : "message message-success"
              }
            >
              {msg}
            </p>
          )}

          <label className="form-label">
            Customer Search (Name or Meter No)
            <input
              type="text"
              className="form-input"
              list="customer-options"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                const found = customers.find(
                  (c) => `${c.name} — ${c.meterNo}` === e.target.value,
                );
                setForm({ ...form, customerId: found ? found._id : "" });
              }}
              placeholder="Type to search..."
              required
            />
            <datalist id="customer-options">
              {customers.map((c) => (
                <option key={c._id} value={`${c.name} — ${c.meterNo}`} />
              ))}
            </datalist>
          </label>

          <label className="form-label">
            Bill Month
            <input
              type={supportsMonthInput ? "month" : "text"}
              className="form-input"
              value={form.billMonth}
              onChange={(e) => setForm({ ...form, billMonth: e.target.value })}
              inputMode="numeric"
              placeholder="YYYY-MM"
              pattern="\\d{4}-\\d{2}"
              title="Use YYYY-MM format"
              required
            />
          </label>

          <div className="form-grid form-grid-compact">
            <label className="form-label">
              Previous Reading (kWh)
              <input
                type="number"
                className="form-input"
                value={form.previousReading}
                onChange={(e) =>
                  setForm({ ...form, previousReading: e.target.value })
                }
                required
              />
            </label>
            <label className="form-label">
              Current Reading (kWh)
              <input
                type="number"
                className="form-input"
                value={form.currentReading}
                onChange={(e) =>
                  setForm({ ...form, currentReading: e.target.value })
                }
                required
              />
            </label>
          </div>

          <label className="form-label">
            Fine Amount (BDT — optional)
            <input
              type="number"
              className="form-input"
              min="0"
              step="0.01"
              value={form.fine}
              onChange={(e) => setForm({ ...form, fine: e.target.value })}
            />
          </label>

          <label className="form-label">
            Fine Note (optional)
            <input
              className="form-input"
              value={form.fineNote}
              onChange={(e) => setForm({ ...form, fineNote: e.target.value })}
              placeholder="e.g. Late payment penalty"
            />
          </label>

          <label className="form-label">
            Due Date
            <input
              type="date"
              className="form-input"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              required
            />
          </label>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ background: "#2f855a" }}
          >
            Generate & Download PDF
          </button>
        </form>
      </div>

      {/* Calculation Preview */}
      <div>
        <h2>Bill Summary</h2>
        {preview ? (
          <div className="card" style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "250px",
              }}
            >
              <tbody>
                {[
                  ["Units Consumed", `${preview.units} kWh`],
                  [`Rate per Unit`, `৳ ${config.ratePerUnit}`],
                  [`Unit Charge`, `৳ ${preview.unitCharge.toFixed(2)}`],
                  [
                    `Service Charge`,
                    `৳ ${(config.serviceCharge || 0).toFixed(2)}`,
                  ],
                  [`Fine`, `৳ ${Number(form.fine || 0).toFixed(2)}`],
                  [
                    `VAT (${config.vatPercent}%)`,
                    `৳ ${preview.vatAmount.toFixed(2)}`,
                  ],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: "0.75rem 0.5rem", color: "#718096" }}>
                      {k}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "monospace",
                        padding: "0.75rem 0.5rem",
                      }}
                    >
                      {v}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid #e2e8f0" }}>
                  <td
                    style={{
                      padding: "0.75rem 0.5rem",
                      fontWeight: "700",
                      fontSize: "1rem",
                    }}
                  >
                    Total Payable
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontWeight: "700",
                      fontSize: "1rem",
                      color: "#2b6cb0",
                      padding: "0.75rem 0.5rem",
                    }}
                  >
                    ৳ {preview.total.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div
            className="card"
            style={{
              color: "#a0aec0",
              textAlign: "center",
            }}
          >
            Enter meter readings to see bill summary
          </div>
        )}
      </div>
    </div>
  );
}
