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
    const { status, paidAt, fine, fineType, finePercent, fineNote } = req.body;

    if (!["paid", "unpaid"].includes(status)) {
      return res.status(400).json({ message: "Invalid invoice status" });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    invoice.status = status;
    invoice.paidAt = status === "paid" ? paidAt || new Date() : null;

    if (status === "paid") {
      if (fine !== undefined) {
        const fineAmount = Number(fine || 0);
        if (!Number.isFinite(fineAmount) || fineAmount < 0) {
          return res.status(400).json({ message: "Invalid fine amount" });
        }
        invoice.fine = fineAmount;
      }
      if (fineType !== undefined) {
        if (!["fixed", "percentage"].includes(fineType)) {
          return res.status(400).json({ message: "Invalid fine type" });
        }
        invoice.fineType = fineType;
      }
      if (finePercent !== undefined) {
        const percent = Number(finePercent || 0);
        if (!Number.isFinite(percent) || percent < 0) {
          return res.status(400).json({ message: "Invalid fine percentage" });
        }
        invoice.finePercent = percent;
      }
      if (fineNote !== undefined) invoice.fineNote = fineNote || "";
    }

    await invoice.save();

    const populated = await Invoice.findById(invoice._id).populate("customer");
    res.json(populated);
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
