import { useState, useEffect } from "react";
import api from "../../api";

export default function CustomerTab() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    name: "",
    address: "",
    meterNo: "",
    phone: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const load = async () => {
    const res = await api.get("/customers");
    setCustomers(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, form);
        setMsg("Customer updated!");
      } else {
        await api.post("/customers", form);
        setMsg("Customer added!");
      }
      setForm({ name: "", address: "", meterNo: "", phone: "" });
      setEditingId(null);
      load();
    } catch (err) {
      setMsg(err.response?.data?.message || "Error saving customer");
    }
  };

  const handleEdit = (c) => {
    setForm({
      name: c.name,
      address: c.address,
      meterNo: c.meterNo,
      phone: c.phone || "",
    });
    setEditingId(c._id);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this customer?")) return;
    await api.delete(`/customers/${id}`);
    load();
  };

  return (
    <div>
      <h2>Customer Management</h2>

      {/* Form */}
      <form onSubmit={handleSubmit} className="form form-grid mb-2">
        <h3 style={{ gridColumn: "1/-1", margin: 0, marginBottom: "0.5rem" }}>
          {editingId ? "Edit Customer" : "Add Customer"}
        </h3>
        {msg && (
          <p
            style={{
              gridColumn: "1/-1",
              color:
                msg.includes("Error") || msg.includes("exists")
                  ? "#e53e3e"
                  : "#38a169",
              margin: 0,
              marginBottom: "0.5rem",
            }}
            className={
              msg.includes("Error") || msg.includes("exists")
                ? "message-error"
                : "message-success"
            }
          >
            {msg}
          </p>
        )}

        {[
          ["name", "Full Name"],
          ["address", "Address"],
          ["meterNo", "Meter Number"],
          ["phone", "Phone (optional)"],
        ].map(([field, label]) => (
          <label key={field} className="form-label">
            {label}
            <input
              className="form-input"
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              required={field !== "phone"}
            />
          </label>
        ))}

        <div
          style={{
            gridColumn: "1/-1",
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <button type="submit" className="btn btn-primary">
            {editingId ? "Update" : "Add Customer"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ name: "", address: "", meterNo: "", phone: "" });
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Search */}
      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search by Name, Meter No, or Address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              {["Name", "Address", "Meter No", "Phone", "Actions"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers
              .filter((c) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  c.name?.toLowerCase().includes(q) ||
                  c.meterNo?.toLowerCase().includes(q) ||
                  c.address?.toLowerCase().includes(q)
                );
              })
              .map((c) => (
                <tr key={c._id}>
                  <td>{c.name}</td>
                  <td
                    style={{
                      maxWidth: "150px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.address}
                  </td>
                  <td style={{ fontFamily: "monospace" }}>{c.meterNo}</td>
                  <td>{c.phone || "-"}</td>
                  <td
                    style={{
                      display: "flex",
                      gap: "0.25rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => handleEdit(c)}
                      className="btn"
                      style={{
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.75rem",
                        background: "#f6ad55",
                        color: "#fff",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c._id)}
                      className="btn"
                      style={{
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.75rem",
                        background: "#fc8181",
                        color: "#fff",
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            {customers.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "2rem",
                    textAlign: "center",
                    color: "#a0aec0",
                  }}
                >
                  No customers yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
