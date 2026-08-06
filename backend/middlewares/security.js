const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Security headers
function setSecurityHeaders(app) {
    app.use(helmet());
    app.use(helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "https://browser.sentry-cdn.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
            fontSrc: ["'self'", "fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", process.env.FRONTEND_URL, "https://sandbox.plaid.com", "https://api.coingecko.com", "https://eth-mainnet.alchemyapi.io", "https://solana-mainnet.alchemyapi.io"],
            frameSrc: ["https://sandbox.plaid.com"], // For Plaid Link
        },
    }));
}

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use the remote IP address; requires `app.set('trust proxy', ...)` in server.js
        return req.ip;
    },
});

// Input validation for login
const validateLogin = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
];

// Input validation for crypto wallet
const validateCryptoWallet = [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('address').trim().isLength({ min: 10, max: 255 }),
    body('symbol').trim().isLength({ min: 2, max: 10 }),
    body('network').trim().isLength({ min: 2, max: 50 }),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
];

module.exports = { setSecurityHeaders, apiLimiter, validateLogin, validateCryptoWallet };