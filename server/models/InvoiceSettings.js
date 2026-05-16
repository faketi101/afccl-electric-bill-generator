const mongoose = require('mongoose');

// Singleton document for invoice header/footer customization
const settingsSchema = new mongoose.Schema({
  companyName:    { type: String, default: 'Electric Utility Company' },
  companyAddress: { type: String, default: '' },
  companyPhone:   { type: String, default: '' },
  companyEmail:   { type: String, default: '' },
  logoBase64:     { type: String, default: '' }, // base64 encoded image
  logoMimeType:   { type: String, default: 'image/png' },
  footerText:     { type: String, default: 'Thank you for paying your bill on time.' },
  invoiceTitle:   { type: String, default: 'ELECTRICITY BILL' },
}, { timestamps: true });

module.exports = mongoose.model('InvoiceSettings', settingsSchema);
