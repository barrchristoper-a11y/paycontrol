const db = require('../config/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createCustomer(email, name) {
    return await stripe.customers.create({
        email,
        name,
        metadata: { user_id: email },
    });
}

async function createPaymentIntent(amount, currency, customerId, description) {
    return await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency,
        customer: customerId,
        description,
        automatic_payment_methods: { enabled: true },
    });
}

async function handleStripeWebhook(sig, payload) {
    const event = stripe.webhooks.constructEvent(
        payload,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
        case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object;
            await db.query(
                `INSERT INTO transactions 
         (user_id, type, gateway, method, amount, amount_usd, description, status, tx_hash) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    paymentIntent.metadata.user_id,
                    'receive',
                    'Stripe',
                    paymentIntent.payment_method_types[0],
                    paymentIntent.amount / 100,
                    paymentIntent.amount / 100,
                    paymentIntent.description,
                    'settled',
                    paymentIntent.id,
                ]
            );
            break;
        }
        case 'payment_intent.payment_failed': {
            const paymentIntent = event.data.object;
            await db.query(
                `INSERT INTO transactions 
         (user_id, type, gateway, method, amount, amount_usd, description, status, tx_hash) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    paymentIntent.metadata.user_id,
                    'receive',
                    'Stripe',
                    paymentIntent.payment_method_types[0],
                    paymentIntent.amount / 100,
                    paymentIntent.amount / 100,
                    paymentIntent.description,
                    'failed',
                    paymentIntent.id,
                ]
            );
            break;
        }
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }
}

module.exports = { createCustomer, createPaymentIntent, handleStripeWebhook };