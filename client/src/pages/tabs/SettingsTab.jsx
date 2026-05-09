import { useState, useEffect } from "react";
import api from "../../api";

export default function SettingsTab() {
  const [form, setForm] = useState({
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    logoBase64: "",
    logoMimeType: "image/png",
    footerText: "",
    invoiceTitle: "ELECTRICITY BILL",
  });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get("/settings").then((res) => setForm(res.data));
  }, []);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      setForm((f) => ({ ...f, logoBase64: base64, logoMimeType: file.type }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.put("/settings", form);
      setMsg("Settings saved!");
    } catch {
      setMsg("Error saving settings");
    }
  };

  return (
    <div>
      <h2>Invoice Settings</h2>
      <form
        onSubmit={handleSave}
        className="form form-grid"
        style={{ maxWidth: "700px" }}
      >
        {msg && (
          <p
            style={{ gridColumn: "1/-1", color: "#38a169", margin: 0 }}
            className="message message-success"
          >
            {msg}
          </p>
        )}

        {[
          ["invoiceTitle", "Invoice Title"],
          ["companyName", "Company Name"],
          ["companyAddress", "Company Address"],
          ["companyPhone", "Phone"],
          ["companyEmail", "Email"],
        ].map(([field, label]) => (
          <label key={field} className="form-label">
            {label}
            <input
              className="form-input"
              value={form[field] || ""}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            />
          </label>
        ))}

        <label className="form-label" style={{ gridColumn: "1/-1" }}>
          Footer Text
          <textarea
            className="form-input"
            value={form.footerText || ""}
            onChange={(e) => setForm({ ...form, footerText: e.target.value })}
            style={{ height: "80px", resize: "vertical" }}
          />
        </label>

        <div style={{ gridColumn: "1/-1" }}>
          <label className="form-label">
            Company Logo (PNG/JPG)
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleLogoUpload}
              style={{ fontSize: "0.9rem" }}
            />
          </label>
          {form.logoBase64 && (
            <img
              src={`data:${form.logoMimeType};base64,${form.logoBase64}`}
              alt="Logo preview"
              style={{
                maxHeight: "80px",
                marginTop: "0.5rem",
                border: "1px solid #e2e8f0",
                borderRadius: "4px",
                padding: "4px",
              }}
            />
          )}
        </div>

        <div style={{ gridColumn: "1/-1" }}>
          <button type="submit" className="btn btn-primary">
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
