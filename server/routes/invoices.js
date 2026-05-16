const express = require("express");
const Invoice = require("../models/Invoice");
const auth = require("../middleware/auth");
const router = express.Router();

router.use(auth);

// Auto-generate invoice number: INV-YYYYMM-XXXX
async function generateInvoiceNo() {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-`;
  const count = await Invoice.countDocuments();
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

// GET /api/invoices  (with optional filters: status, customerId)
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.customerId) filter.customer = req.query.customerId;

    const invoices = await Invoice.find(filter)
      .populate("customer")
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/invoices/:id
router.get("/:id", async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("customer");
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/invoices
router.post("/", async (req, res) => {
  try {
    const { customer, billMonth } = req.body;
    const exists = await Invoice.findOne({ customer, billMonth });
    if (exists) {
      return res
        .status(409)
        .json({
          message: "Invoice already exists for this customer and month",
        });
    }
    const invoiceNo = await generateInvoiceNo();
    const invoice = new Invoice({ ...req.body, invoiceNo });
    await invoice.save();
    const populated = await Invoice.findById(invoice._id).populate("customer");
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/invoices/:id/status  — mark paid or unpaid
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === "paid") update.paidAt = new Date();
    else update.paidAt = null;

    const invoice = await Invoice.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).populate("customer");
    res.json(invoice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/invoices/:id
router.delete("/:id", async (req, res) => {
  try {
    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ message: "Invoice deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
