const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  nameBn:       { type: String, trim: true },
  address:      { type: String, required: true, trim: true },
  addressBn:    { type: String, trim: true },
  meterNo:      { type: String, required: true, unique: true, trim: true },
  meterNoBn:    { type: String, trim: true },
  phone:        { type: String, trim: true },
  phoneBn:      { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
