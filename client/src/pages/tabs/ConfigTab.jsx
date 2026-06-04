import { useState, useEffect } from "react";
import api from "../../api";

const defaultConfig = {
  ratePerUnit: 8,
  serviceCharge: 0,
  vatPercent: 0,
  fineType: "percentage",
  fixedFineAmount: 0,
  finePercent: 0,
  pdfLanguage: "bangla_english",
};

const normalizeConfig = (value = {}) => ({
  ...defaultConfig,
  ...value,
  fineType: value.fineType || "percentage",
});

export default function ConfigTab() {
  const [config, setConfig] = useState(defaultConfig);
  const [previewUnits, setPreviewUnits] = useState(100);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get("/config").then((res) => setConfig(normalizeConfig(res.data)));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put("/config", config);
      setConfig(normalizeConfig(res.data));
      setMsg("Configuration saved!");
    } catch (err) {
      setMsg("Error saving configuration");
    }
  };

  // Live preview calculation
  const unitCharge = previewUnits * config.ratePerUnit;
  const subtotal = unitCharge + Number(config.serviceCharge);
  const fineAmount =
    config.fineType === "fixed"
      ? Number(config.fixedFineAmount || 0)
      : (subtotal * Number(config.finePercent || 0)) / 100;
  const subtotalWithFine = subtotal + fineAmount;
  const vat = (subtotalWithFine * config.vatPercent) / 100;
  const total = subtotalWithFine + vat;

  return (
    <div className="grid-2">
      <div>
        <h2>Rate Configuration</h2>
        <form onSubmit={handleSave} className="form">
          {msg && <p className="message message-success">{msg}</p>}

          <label className="form-label">
            Rate per Unit (BDT / kWh)
            <input
              type="number"
              className="form-input"
              min="0"
              step="0.01"
              value={config.ratePerUnit}
              onChange={(e) =>
                setConfig({
                  ...config,
                  ratePerUnit: parseFloat(e.target.value),
                })
              }
              required
            />
          </label>

          <label className="form-label">
            Service Charge (BDT, fixed)
            <input
              type="number"
              className="form-input"
              min="0"
              step="0.01"
              value={config.serviceCharge}
              onChange={(e) =>
                setConfig({
                  ...config,
                  serviceCharge: parseFloat(e.target.value),
                })
              }
            />
          </label>

          <label className="form-label">
            VAT (%)
            <input
              type="number"
              className="form-input"
              min="0"
              max="100"
              step="0.1"
              value={config.vatPercent}
              onChange={(e) =>
                setConfig({ ...config, vatPercent: parseFloat(e.target.value) })
              }
            />
          </label>

          <label className="form-label">
            Default Fine Type
            <select
              className="form-input"
              value={config.fineType || "percentage"}
              onChange={(e) =>
                setConfig({ ...config, fineType: e.target.value })
              }
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </label>

          <div className="form-grid form-grid-compact">
            <label className="form-label">
              Fine Percentage (%)
              <input
                type="number"
                className="form-input"
                min="0"
                step="0.1"
                value={config.finePercent || 0}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    finePercent: Number(e.target.value || 0),
                  })
                }
              />
            </label>

            <label className="form-label">
              Fixed Fine Amount (BDT)
              <input
                type="number"
                className="form-input"
                min="0"
                step="0.01"
                value={config.fixedFineAmount || 0}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    fixedFineAmount: Number(e.target.value || 0),
                  })
                }
              />
            </label>
          </div>

          <label className="form-label">
            PDF Language
            <select
              className="form-input"
              value={config.pdfLanguage || "bangla_english"}
              onChange={(e) =>
                setConfig({ ...config, pdfLanguage: e.target.value })
              }
            >
              <option value="bangla">Bangla</option>
              <option value="english">English</option>
              <option value="bangla_english">Bangla and English</option>
            </select>
          </label>

          <button type="submit" className="btn btn-primary">
            Save Configuration
          </button>
        </form>
      </div>

      {/* Live Preview */}
      <div>
        <h2>Bill Preview Calculator</h2>
        <div className="card">
          <label className="form-label">
            Units consumed (preview)
            <input
              type="number"
              className="form-input"
              value={previewUnits}
              onChange={(e) => setPreviewUnits(Number(e.target.value))}
            />
          </label>
          <hr style={{ margin: "1rem 0", borderColor: "#e2e8f0" }} />
          <table>
            {[
              ["Units Consumed", `${previewUnits} kWh`],
              [`Rate per Unit`, `৳ ${config.ratePerUnit}`],
              [`Unit Charge`, `৳ ${unitCharge.toFixed(2)}`],
              [
                `Service Charge`,
                `৳ ${Number(config.serviceCharge).toFixed(2)}`,
              ],
              [
                config.fineType === "fixed"
                  ? "Fixed Fine"
                  : `Fine (${Number(config.finePercent || 0)}%)`,
                `৳ ${fineAmount.toFixed(2)}`,
              ],
              [`VAT (${config.vatPercent}%)`, `৳ ${vat.toFixed(2)}`],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{ padding: "0.4rem 0", color: "#718096" }}>{k}</td>
                <td
                  style={{
                    padding: "0.4rem 0",
                    textAlign: "right",
                    fontFamily: "monospace",
                  }}
                >
                  {v}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid #e2e8f0" }}>
              <td
                style={{
                  padding: "0.6rem 0",
                  fontWeight: "700",
                  fontSize: "1.1rem",
                }}
              >
                Total
              </td>
              <td
                style={{
                  padding: "0.6rem 0",
                  textAlign: "right",
                  fontWeight: "700",
                  fontSize: "1.1rem",
                  color: "#2b6cb0",
                }}
              >
                ৳ {total.toFixed(2)}
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  );
}
