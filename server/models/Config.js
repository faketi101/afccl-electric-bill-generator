const mongoose = require('mongoose');

// Only one config document will exist (singleton)
const configSchema = new mongoose.Schema({
  ratePerUnit:  { type: Number, required: true, default: 8.0 }, // BDT per kWh
  serviceCharge:{ type: Number, default: 0 },
  vatPercent:   { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Config', configSchema);
