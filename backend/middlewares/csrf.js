const crypto = require('crypto');

// ========================================
// CSRF Protection Middleware
// ========================================
// Uses double-submit cookie pattern:
// 1. Backend sets a random CSRF token in a cookie
// 2. Frontend sends token in X-CSRF-Token header
// 3. Backend verifies cookie token matches header token

function generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Middleware to generate and validate CSRF tokens
function csrfProtection(req, res, next) {
    // Generate or retrieve CSRF token
    let csrfToken = req.cookies?.csrfToken;
    
    if (!csrfToken) {
        // Generate new token if not present
        csrfToken = generateCSRFToken();
        res.cookie('csrfToken', csrfToken, {
            httpOnly: false,  // Must be accessible to JavaScript
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000,  // 24 hours
            path: '/'
        });
    }

    // For safe methods (GET, HEAD, OPTIONS), just set the token
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    // For state-changing methods (POST, PUT, DELETE, PATCH), validate token
    const tokenFromHeader = req.header('X-CSRF-Token');
    
    if (!tokenFromHeader) {
        return res.status(403).json({ 
            error: 'CSRF token missing. Include X-CSRF-Token header.' 
        });
    }

    if (tokenFromHeader !== csrfToken) {
        return res.status(403).json({ 
            error: 'CSRF token validation failed.' 
        });
    }

    next();
}

module.exports = { csrfProtection, generateCSRFToken };
