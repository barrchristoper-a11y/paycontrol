require('dotenv').config();

// ========================================
// CRITICAL: Validate required environment variables
// ========================================
const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'NODE_ENV',
    'PORT',
    'FRONTEND_URL'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error('❌ FATAL: Missing required environment variables:');
    missingEnvVars.forEach(envVar => console.error(`   - ${envVar}`));
    console.error('\n📖 Please copy .env.example to .env and fill in all values.');
    process.exit(1);
}

console.log('✅ All required environment variables present');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { setSecurityHeaders, apiLimiter } = require('./middlewares/security');
const { errorHandler } = require('./middlewares/error');
const { csrfProtection } = require('./middlewares/csrf');
const authRoutes = require('./routes/auth');
const cryptoRoutes = require('./routes/crypto');
const bankRoutes = require('./routes/banks');
const gatewayRoutes = require('./routes/gateways');
const allocationRoutes = require('./routes/allocation');
const transactionRoutes = require('./routes/transactions');

const app = express();
app.get("/", (req, res) => {
    res.json({
        service: "PayControl API",
        status: "running",
        version: "1.0.0"
    });
});

// ✅ FIX: Trust proxy headers (for Render/Vercel/Cloudflare)
app.set('trust proxy', 2);  // Trust first 2 proxies (e.g., Render + Cloudflare)

// Rest of your middleware...
app.use(helmet());

// Security
setSecurityHeaders(app);
app.use(helmet());

// ========================================
// HTTPS Enforcement (redirect HTTP to HTTPS in production)
// ========================================
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        // When behind reverse proxy (Vercel, Render, Cloudflare), check x-forwarded-proto
        if (req.header('x-forwarded-proto') !== 'https') {
            return res.redirect(301, `https://${req.header('host')}${req.originalUrl}`);
        }
        next();
    });

    // Add HSTS header (tell browsers to always use HTTPS)
    app.use((req, res, next) => {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        next();
    });
}

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
}));
app.use(apiLimiter);
app.use(compression());
app.use(cookieParser());
app.use(csrfProtection);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/gateways', gatewayRoutes);
app.use('/api/allocation', allocationRoutes);
app.use('/api/transactions', transactionRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

// ========================================
// Graceful Shutdown Handlers
// ========================================
const gracefulShutdown = (signal) => {
    console.log(`\n📍 ${signal} received. Starting graceful shutdown...`);

    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error('❌ Forced shutdown: Graceful shutdown timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

module.exports = app;