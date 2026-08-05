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
            query += ` AND type = $${paramIndex++}`;
            params.push(type);
        }
        if (gateway) {
            query += ` AND gateway = $${paramIndex++}`;
            params.push(gateway);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        logger.error(`Failed to fetch transactions: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch transactions.' });
    }
});

// Get transaction by ID
router.get('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await db.query(
            `SELECT * FROM transactions WHERE id = $1 AND user_id = $2`,
            [id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found or not owned by user.' });
        }
        res.json(rows[0]);
    } catch (error) {
        logger.error(`Failed to fetch transaction: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch transaction.' });
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