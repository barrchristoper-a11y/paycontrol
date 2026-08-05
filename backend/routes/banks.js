const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middlewares/auth');
const { createLinkToken, exchangePublicToken, getAccounts } = require('../services/plaid');
const logger = require('../logger');

// Create a Plaid Link token
router.get('/link-token', authenticate, async (req, res) => {
    try {
        const linkToken = await createLinkToken(req.user.id);
        res.json({ link_token: linkToken });
    } catch (error) {
        logger.error(`Failed to create Plaid link token: ${error.message}`);
        res.status(500).json({ error: 'Failed to create link token.' });
    }
});

// Exchange public token for access token
router.post('/exchange-token', authenticate, async (req, res) => {
    const { publicToken, metadata } = req.body;
    if (!publicToken) {
        return res.status(400).json({ error: 'Public token is required.' });
    }

    try {
        const { access_token, item_id } = await exchangePublicToken(publicToken);
        const accounts = await getAccounts(access_token);

        // Save accounts to database
        for (const account of accounts) {
            const balance = account.balances?.available || 0;
            const currency = account.balances?.iso_currency_code || 'USD';

            await db.query(
                `INSERT INTO bank_accounts 
         (user_id, name, bank_name, account_type, last4, balance, currency, status, plaid_item_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         ON CONFLICT (plaid_item_id) DO UPDATE 
         SET name = $2, bank_name = $3, account_type = $4, last4 = $5, balance = $6, currency = $7, status = $8`,
                [
                    req.user.id,
                    account.name,
                    metadata.institution.name,
                    account.type,
                    account.mask,
                    balance,
                    currency,
                    'verified',
                    item_id,
                ]
            );
        }

        // Log action
        await db.query(
            `INSERT INTO audit_logs (user_id, action, resource, details, ip_address) 
       VALUES ($1, 'link_bank', 'bank_accounts', $2, $3)`,
            [req.user.id, JSON.stringify({ institution: metadata.institution.name, accounts: accounts.length }), req.ip]
        );

        res.json({ success: true, accounts: accounts.length });
    } catch (error) {
        logger.error(`Plaid exchange token error: ${error.message}`);
        res.status(500).json({ error: 'Failed to exchange token.' });
    }
});

// Get user's bank accounts
router.get('/accounts', authenticate, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT id, name, bank_name, account_type, last4, balance, currency, status 
       FROM bank_accounts WHERE user_id = $1 ORDER BY created_at DESC`,
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        logger.error(`Failed to fetch bank accounts: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch bank accounts.' });
    }
});

// Delete a bank account
router.delete('/accounts/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await db.query(
            'DELETE FROM bank_accounts WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Bank account not found or not owned by user.' });
        }

        // Log action
        await db.query(
            `INSERT INTO audit_logs (user_id, action, resource, details, ip_address) 
       VALUES ($1, 'delete_bank', 'bank_accounts', $2, $3)`,
            [req.user.id, JSON.stringify({ id }), req.ip]
        );

        res.json({ success: true });
    } catch (error) {
        logger.error(`Failed to delete bank account: ${error.message}`);
        res.status(500).json({ error: 'Failed to delete bank account.' });
    }
});

module.exports = router;