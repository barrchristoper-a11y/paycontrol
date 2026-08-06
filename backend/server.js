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
const overviewRoutes = require('./routes/overview');

const app = express();

// ========================================
// Trust proxy headers (Render/Vercel/Cloudflare)
// ========================================
app.set('trust proxy', 2);

// ========================================
// Root status endpoint
// ========================================
app.get("/", (req, res) => {
    res.json({
        service: "PayControl API",
        status: "running",
        version: "1.0.0"
    });
});

// ========================================
// Security Middleware
// ========================================
setSecurityHeaders(app);
app.use(helmet());

// ========================================
// HTTPS Enforcement
// ========================================
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            return res.redirect(
                301,
                `https://${req.header('host')}${req.originalUrl}`
            );
        }
        next();
    });

    app.use((req, res, next) => {
        res.setHeader(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains; preload'
        );
        next();
    });
}

// ========================================
// CORS
// ========================================
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
}));

// ========================================
// Core Middleware
// ========================================
app.use(apiLimiter);
app.use(compression());
app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================================
// Logging
// ========================================
app.use(morgan('combined'));

// ========================================
// CSRF Protection
// ========================================
app.use(csrfProtection);

// ========================================
// API Routes
// ========================================
app.use('/api/auth', authRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/gateways', gatewayRoutes);
app.use('/api/allocation', allocationRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/overview', overviewRoutes);

// ========================================
// Health Check
// ========================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

// ========================================
// 404 Handler
// ========================================
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found'
    });
});

// ========================================
// Global Error Handler
// ========================================
app.use(errorHandler);

// ========================================
// Server Start
// ========================================
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

// ========================================
// Graceful Shutdown
// ========================================
const gracefulShutdown = (signal) => {
    console.log(`\n📍 ${signal} received. Starting graceful shutdown...`);

    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });

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