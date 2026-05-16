const express = require('express');
const InvoiceSettings = require('../models/InvoiceSettings');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    let settings = await InvoiceSettings.findOne();
    if (!settings) settings = await new InvoiceSettings({}).save();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/settings  — accepts JSON with optional logoBase64
router.put('/', async (req, res) => {
  try {
    let settings = await InvoiceSettings.findOne();
    if (!settings) {
      settings = new InvoiceSettings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
