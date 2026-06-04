const mongoose = require('mongoose');

// Only one config document will exist (singleton)
const configSchema = new mongoose.Schema({
  ratePerUnit:  { type: Number, required: true, default: 8.0 }, // BDT per kWh
  serviceCharge:{ type: Number, default: 0 },
  vatPercent:   { type: Number, default: 0 },
  fineType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'percentage',
  },
  fixedFineAmount: { type: Number, default: 0 },
  finePercent: { type: Number, default: 0 },
  pdfLanguage:  {
    type: String,
    enum: ['bangla', 'english', 'bangla_english'],
    default: 'bangla_english',
  },
}, { timestamps: true });

module.exports = mongoose.model('Config', configSchema);
