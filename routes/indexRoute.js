const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.send('KKF HD Backend is running');
});

module.exports = router;
