const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, adminOnly } = require('../middlewares/auth');
const { createCustomer, createPaymentIntent, handleStripeWebhook } = require('../services/stripe');
const logger = require('../logger');

// Get user's payment gateways
router.get('/', authenticate, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT id, name, fee, fixed_fee, is_enabled, monthly_volume, transaction_count 
       FROM payment_gateways WHERE user_id = $1 ORDER BY created_at DESC`,
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        logger.error(`Failed to fetch gateways: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch gateways.' });
    }
});

// Enable/disable a gateway
router.patch('/:id/enable', authenticate, async (req, res) => {
    const { id } = req.params;
    const { isEnabled } = req.body;
    try {
        const { rows } = await db.query(
            `UPDATE payment_gateways SET is_enabled = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
            [isEnabled, id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Gateway not found or not owned by user.' });
        }
        res.json(rows[0]);
    } catch (error) {
        logger.error(`Failed to update gateway: ${error.message}`);
        res.status(500).json({ error: 'Failed to update gateway.' });
    }
});

// Stripe webhook
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  try {
    await handleStripeWebhook(sig, req.body);
    } catch (error) {
        logger.error(`Stripe webhook error: ${error.message}`);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
});

// Create a Stripe payment intent (example)
router.post('/stripe/payment-intent', authenticate, async (req, res) => {
    const { amount, currency = 'usd', description } = req.body;
    try {
        // Get or create Stripe customer
        const customerRows = await db.query(
            'SELECT stripe_customer_id FROM users WHERE id = $1',
            [req.user.id]
        );
        let customerId = customerRows[0]?.stripe_customer_id;
        if (!customerId) {
            const user = await db.query('SELECT email, first_name, last_name FROM users WHERE id = $1', [req.user.id]);
            const customer = await createCustomer(
                user.rows[0].email,
                `${user.rows[0].first_name} ${user.rows[0].last_name}`
            );
            customerId = customer.id;
            await db.query(
                'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
                [customerId, req.user.id]
            );
        }

        const paymentIntent = await createPaymentIntent(amount, currency, customerId, description);
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        logger.error(`Failed to create payment intent: ${error.message}`);
        res.status(500).json({ error: 'Failed to create payment intent.' });
    }
});

module.exports = router;