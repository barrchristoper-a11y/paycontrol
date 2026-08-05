const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middlewares/auth');
const { validateCryptoWallet } = require('../middlewares/validation');
const { getCryptoPrices } = require('../services/coinGecko');
const { getEthBalance, getSolBalance } = require('../services/alchemy');
const logger = require('../logger');

// Get crypto prices
router.get('/prices', authenticate, async (req, res) => {
    try {
        const symbols = ['bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana', 'matic-network'];
        const prices = await getCryptoPrices(symbols);
        res.json(prices);
    } catch (error) {
        logger.error(`Failed to fetch crypto prices: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch prices.' });
    }
});

// Get user's crypto wallets
router.get('/wallets', authenticate, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT id, name, address, symbol, network, balance, balance_usd, is_verified 
       FROM crypto_wallets WHERE user_id = $1 ORDER BY created_at DESC`,
            [req.user.id]
        );

        // Fetch live balances for each wallet
        const walletsWithBalances = await Promise.all(rows.map(async (wallet) => {
            try {
                let balance = wallet.balance;
                if (wallet.network.toLowerCase() === 'ethereum') {
                    balance = await getEthBalance(wallet.address);
                } else if (wallet.network.toLowerCase() === 'solana') {
                    balance = await getSolBalance(wallet.address);
                }
                return { ...wallet, balance };
            } catch (error) {
                logger.error(`Failed to fetch balance for ${wallet.address}: ${error.message}`);
                return wallet; // Return existing balance if API fails
            }
        }));

        res.json(walletsWithBalances);
    } catch (error) {
        logger.error(`Failed to fetch wallets: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch wallets.' });
    }
});

// Add a new crypto wallet
router.post('/wallets', authenticate, validateCryptoWallet, async (req, res) => {
    const { name, address, symbol, network } = req.body;
    try {
        // Check if wallet already exists
        const existing = await db.query(
            'SELECT 1 FROM crypto_wallets WHERE address = $1',
            [address]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Wallet already exists.' });
        }

        // Add wallet
        const { rows } = await db.query(
            `INSERT INTO crypto_wallets (user_id, name, address, symbol, network) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [req.user.id, name, address, symbol, network]
        );

        // Log action
        await db.query(
            `INSERT INTO audit_logs (user_id, action, resource, details, ip_address) 
       VALUES ($1, 'add_wallet', 'crypto_wallets', $2, $3)`,
            [req.user.id, JSON.stringify({ name, address, symbol, network }), req.ip]
        );

        res.json(rows[0]);
    } catch (error) {
        logger.error(`Failed to add wallet: ${error.message}`);
        res.status(500).json({ error: 'Failed to add wallet.' });
    }
});

// Delete a crypto wallet
router.delete('/wallets/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await db.query(
            'DELETE FROM crypto_wallets WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Wallet not found or not owned by user.' });
        }

        // Log action
        await db.query(
            `INSERT INTO audit_logs (user_id, action, resource, details, ip_address) 
       VALUES ($1, 'delete_wallet', 'crypto_wallets', $2, $3)`,
            [req.user.id, JSON.stringify({ id }), req.ip]
        );

        res.json({ success: true });
    } catch (error) {
        logger.error(`Failed to delete wallet: ${error.message}`);
        res.status(500).json({ error: 'Failed to delete wallet.' });
    }
});

module.exports = router;