const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Overview route working',
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;