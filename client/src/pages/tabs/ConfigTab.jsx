import { useState, useEffect } from "react";
import api from "../../api";

export default function ConfigTab() {
  const [config, setConfig] = useState({
    ratePerUnit: 8,
    serviceCharge: 0,
    vatPercent: 0,
  });
  const [previewUnits, setPreviewUnits] = useState(100);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get("/config").then((res) => setConfig(res.data));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put("/config", config);
      setConfig(res.data);
      setMsg("Configuration saved!");
    } catch (err) {
      setMsg("Error saving configuration");
    }
  };

  // Live preview calculation
  const unitCharge = previewUnits * config.ratePerUnit;
  const subtotal = unitCharge + Number(config.serviceCharge);
  const vat = (subtotal * config.vatPercent) / 100;
  const total = subtotal + vat;

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
