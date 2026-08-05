const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
    // Try to get token from httpOnly cookie first (preferred)
    let token = req.cookies?.accessToken;
    
    // Fallback to Authorization header (for API clients)
    if (!token) {
        token = req.header('Authorization')?.replace('Bearer ', '');
    }

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired.' });
        }
        res.status(401).json({ error: 'Invalid token.' });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
}

module.exports = { authenticate, adminOnly };