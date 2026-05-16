const express = require('express');
const Config = require('../models/Config');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// GET /api/config
router.get('/', async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) {
      config = await new Config({}).save();
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/config
router.put('/', async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) {
      config = new Config(req.body);
    } else {
      Object.assign(config, req.body);
    }
    await config.save();
    res.json(config);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
