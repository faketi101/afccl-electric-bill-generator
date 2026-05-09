const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    billMonth: { type: String, required: true }, // e.g. "January 2025"
    previousReading: { type: Number, required: true },
    currentReading: { type: Number, required: true },
    unitsConsumed: { type: Number }, // auto-calculated
    ratePerUnit: { type: Number, required: true },
    unitCharge: { type: Number }, // auto-calculated
    serviceCharge: { type: Number, default: 0 },
    fine: { type: Number, default: 0 }, // manual fine input
    fineNote: { type: String, default: "" },
    vatPercent: { type: Number, default: 0 },
    vatAmount: { type: Number, default: 0 },
    totalAmount: { type: Number }, // auto-calculated
    status: { type: String, enum: ["paid", "unpaid"], default: "unpaid" },
    paidAt: { type: Date },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
  },
  { timestamps: true },
);

invoiceSchema.index({ customer: 1, billMonth: 1 }, { unique: true });

// Auto-calculate before save
invoiceSchema.pre("save", function (next) {
  this.unitsConsumed = this.currentReading - this.previousReading;
  this.unitCharge = this.unitsConsumed * this.ratePerUnit;
  const subtotal = this.unitCharge + this.serviceCharge + this.fine;
  this.vatAmount = (subtotal * this.vatPercent) / 100;
  this.totalAmount = subtotal + this.vatAmount;
  next();
});

module.exports = mongoose.model("Invoice", invoiceSchema);
