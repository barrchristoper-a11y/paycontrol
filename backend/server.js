require('dotenv').config();

console.log('🚀 Starting PayControl API...');
console.log('📍 Node version:', process.version);
console.log('📍 NODE_ENV:', process.env.NODE_ENV);
console.log('📍 PORT:', process.env.PORT);

// ========================================
// Process-level error logging
// ========================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('❌ Reason:', reason);
  if (reason && reason.stack) console.error(reason.stack);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.error(error.stack);
  process.exit(1);
});

process.on('warning', (warning) => {
  console.warn('⚠️ Process warning:', warning.name);
  console.warn(warning.message);
  console.warn(warning.stack);
});

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
  process.exit(1);
}
console.log('✅ All required environment variables present');

try {
  // ========================================
  // Dependencies
  // ========================================
  console.log('📦 Loading dependencies...');
  const express = require('express');
  const cors = require('cors');
  const helmet = require('helmet');
  const morgan = require('morgan');
  const compression = require('compression');
  const cookieParser = require('cookie-parser');
  const csrf = require('csurf');

  // ========================================
  // Local modules
  // ========================================
  console.log('📦 Loading local modules...');
  const { setSecurityHeaders, apiLimiter } = require('./middlewares/security');
  const { errorHandler } = require('./middlewares/error');
  const authRoutes = require('./routes/auth');
  const cryptoRoutes = require('./routes/crypto');
  const bankRoutes = require('./routes/banks');
  const gatewayRoutes = require('./routes/gateways');
  const allocationRoutes = require('./routes/allocation');
  const transactionRoutes = require('./routes/transactions');
  const overviewRoutes = require('./routes/overview');
  const adminRoutes = require('./routes/admin');

  console.log('✅ All modules loaded successfully');

  // ========================================
  // Express application
  // ========================================
  const app = express();
  app.set('trust proxy', 2);

  // ========================================
  // Root endpoint
  // ========================================
  app.get('/', (req, res) => {
    res.json({
      service: 'PayControl API',
      status: 'running',
      version: '1.0.0'
    });
  });

  // ========================================
  // Security middleware
  // ========================================
  console.log('🔐 Applying security middleware...');
  setSecurityHeaders(app);
  app.use(helmet());

  // ========================================
  // Production HTTPS enforcement
  // ========================================
  if (process.env.NODE_ENV === 'production') {
    console.log('🌐 Enabling production HTTPS enforcement...');
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
  console.log('🌍 Configuring CORS...');
  console.log('🌍 FRONTEND_URL:', process.env.FRONTEND_URL);
  app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
  }));

  // ========================================
  // Core middleware
  // ========================================
  console.log('🧩 Applying core middleware...');
  app.use(apiLimiter);
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ========================================
  // CSRF Protection - Configured for cross-site cookies
  // ========================================
  console.log('🛡️ Applying CSRF protection...');
  const csrfProtection = csrf({
    cookie: {
      httpOnly: true,
      secure: true,               // ✅ Always true (HTTPS required)
      sameSite: 'none',          // ✅ Allows cross-site
      partitioned: true,         // ✅ NEW: Required for Chrome 115+
      maxAge: 86400,
      path: '/'
    }
  });

  // ✅ FIXED: CSRF Token Endpoint (before csrfProtection)
  app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() }); // ✅ Use req.csrfToken() instead of generateToken
  });

  // Apply CSRF protection to all routes EXCEPT /api/csrf-token
  app.use((req, res, next) => {
    if (req.path === '/api/csrf-token') return next();
    csrfProtection(req, res, next);
  });

  // ========================================
  // Request logging
  // ========================================
  console.log('📝 Enabling request logging...');
  app.use(morgan('combined'));

  // ========================================
  // Routes
  // ========================================
  console.log('🛣️ Registering routes...');
  app.use('/api/auth', authRoutes);
  app.use('/api/crypto', cryptoRoutes);
  app.use('/api/banks', bankRoutes);
  app.use('/api/gateways', gatewayRoutes);
  app.use('/api/allocation', allocationRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/overview', overviewRoutes);
  app.use('/api/admin', adminRoutes);

  // ========================================
  // Health check
  // ========================================
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString()
    });
  });

  // ========================================
  // 404 handler
  // ========================================
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found'
    });
  });

  // ========================================
  // Global error handler
  // ========================================
  app.use(errorHandler);

  // ========================================
  // HTTP server
  // ========================================
  const PORT = process.env.PORT || 3000;
  console.log('🚀 Starting HTTP server...');
  const server = app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });

  server.on('error', (err) => {
    console.error('❌ Server failed to start:', err.message);
    console.error(err.stack);
    process.exit(1);
  });

  // ========================================
  // Graceful shutdown
  // ========================================
  const gracefulShutdown = (signal) => {
    console.log(`📍 ${signal} received. Starting graceful shutdown...`);
    server.close((err) => {
      if (err) {
        console.error('❌ Error during server shutdown:', err);
        process.exit(1);
      }
      console.log('✅ HTTP server closed successfully.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('❌ Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10000).unref();
  };
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

} catch (error) {
  console.error('❌ FATAL: Failed to start PayControl API.');
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}