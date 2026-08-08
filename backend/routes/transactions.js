const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middlewares/auth');
const logger = require('../logger');

// Get user's transactions
router.get('/', authenticate, async (req, res) => {
    const { type, gateway, limit = 50, offset = 0 } = req.query;
    try {
        let query = `
      SELECT id, type, gateway, method, amount, amount_usd, from_address, to_address,
             description, status, tx_hash, fee, created_at
      FROM transactions
      WHERE user_id = $1
    `;
        const params = [req.user.id];
        let paramIndex = 2;

        if (type) {
            query += ` AND type = $${paramIndex}`;
            params.push(type);
            paramIndex += 1;
        }

        if (gateway) {
            const gatewayList = gateway.split(',').map(g => g.trim()).filter(Boolean);
            if (gatewayList.length > 1) {
                query += ` AND gateway = ANY($${paramIndex})`;
                params.push(gatewayList);
            } else {
                query += ` AND gateway = $${paramIndex}`;
                params.push(gatewayList[0]);
            }
            paramIndex += 1;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit, 10) || 50, parseInt(offset, 10) || 0);

        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        logger.error(`Failed to fetch transactions: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch transactions.' });
    }
});

// Create a new transaction (for internal use, e.g., allocations)
router.post('/', authenticate, async (req, res) => {
    const { type, gateway, method, amount, amount_usd, from_address, to_address, description, status = 'pending', tx_hash, fee = 0 } = req.body;
    try {
        const { rows } = await db.query(
            `INSERT INTO transactions 
       (user_id, type, gateway, method, amount, amount_usd, from_address, to_address, description, status, tx_hash, fee) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [req.user.id, type, gateway, method, amount, amount_usd, from_address, to_address, description, status, tx_hash, fee]
        );
        res.json(rows[0]);
    } catch (error) {
        logger.error(`Failed to create transaction: ${error.message}`);
        res.status(500).json({ error: 'Failed to create transaction.' });
    }
});

module.exports = router;