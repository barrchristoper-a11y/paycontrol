const express = require('express');
const router = express.Router();

const db = require('../config/db');
const { authenticate } = require('../middlewares/auth');
const logger = require('../logger');


// GET /api/transactions
router.get('/', authenticate, async (req, res) => {
    const { type, gateway, limit = 50, offset = 0 } = req.query;

    try {
        let query = `
            SELECT
                id,
                type,
                gateway,
                method,
                amount,
                amount_usd,
                from_address,
                to_address,
                description,
                status,
                tx_hash,
                fee,
                created_at
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
            const gatewayList = gateway
                .split(',')
                .map(g => g.trim())
                .filter(Boolean);

            if (gatewayList.length > 1) {
                query += ` AND gateway = ANY($${paramIndex})`;
                params.push(gatewayList);
            } else if (gatewayList.length === 1) {
                query += ` AND gateway = $${paramIndex}`;
                params.push(gatewayList[0]);
            }

            paramIndex += 1;
        }

        query += `
            ORDER BY created_at DESC
            LIMIT $${paramIndex}
            OFFSET $${paramIndex + 1}
        `;

        params.push(
            parseInt(limit, 10) || 50,
            parseInt(offset, 10) || 0
        );

        const { rows } = await db.query(query, params);

        res.json(rows);
    } catch (error) {
        logger.error(`Failed to fetch transactions: ${error.message}`);
        res.status(500).json({
            error: 'Failed to fetch transactions.'
        });
    }
});


// GET /api/transactions/:id
router.get('/:id', authenticate, async (req, res) => {
    const { id } = req.params;

    try {
        const { rows } = await db.query(
            `SELECT *
             FROM transactions
             WHERE id = $1
             AND user_id = $2`,
            [id, req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Transaction not found or not owned by user.'
            });
        }

        res.json(rows[0]);
    } catch (error) {
        logger.error(`Failed to fetch transaction: ${error.message}`);
        res.status(500).json({
            error: 'Failed to fetch transaction.'
        });
    }
});


module.exports = router;