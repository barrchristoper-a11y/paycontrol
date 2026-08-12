const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { hashPassword, comparePassword, generateToken, generateRefreshToken } = require('../services/auth');
const { validateLogin } = require('../middlewares/security');
const { authenticate } = require('../middlewares/auth');
const logger = require('../logger');

// Login
router.post('/login', validateLogin, async (req, res) => {
    const { email, password } = req.body;
    try {
        // 1. Find user
        const { rows: userRows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userRows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        const user = userRows[0];

        // 2. Verify password
        const isValid = await comparePassword(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // 3. Generate tokens
        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        // 4. ✅ FIX: Hardcoded interval (no env var dependency)
        await db.query(
            `INSERT INTO refresh_tokens (user_id, token, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '7 days')
             ON CONFLICT (user_id)
             DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at`,
            [user.id, refreshToken]
        );

        // 5. ✅ FIX: Safe audit log insert
        await db.query(
            `INSERT INTO audit_logs (user_id, action, resource, ip_address)
             VALUES ($1, 'login', 'auth', $2)`,
            [user.id, req.ip || 'unknown']
        );

        // 6. Return user data
        const userData = {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
        };

        // 7. Set cookies
        res.cookie('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/',
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        res.json({ success: true, user: userData });
    } catch (error) {
        logger.error(`LOGIN ERROR: ${error.stack || error.message}`);
        res.status(500).json({ error: 'Login failed.' });
    }
});

// Refresh token
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token required.' });
    }

    try {
        // 1. Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        // 2. ✅ FIX: Check rows property
        const { rows: tokenRows } = await db.query(
            'SELECT * FROM refresh_tokens WHERE user_id = $1 AND token = $2 AND expires_at > NOW()',
            [decoded.id, refreshToken]
        );
        if (tokenRows.length === 0) {
            return res.status(401).json({ error: 'Invalid or expired refresh token.' });
        }

        // 3. ✅ FIX: Use rows property
        const { rows: userRows } = await db.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
        if (userRows.length === 0) {
            return res.status(401).json({ error: 'User not found.' });
        }
        const user = userRows[0];

        // 4. Generate new tokens
        const token = generateToken(user);
        const newRefreshToken = generateRefreshToken(user);

        // 5. ✅ FIX: Hardcoded interval
        await db.query(
            `UPDATE refresh_tokens
             SET token = $1, expires_at = NOW() + INTERVAL '7 days'
             WHERE user_id = $2`,
            [newRefreshToken, user.id]
        );

        // 6. Set cookies
        res.cookie('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/',
        });

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });

        res.json({ success: true });
    } catch (error) {
        logger.error(`REFRESH ERROR: ${error.stack || error.message}`);
        res.status(401).json({ error: 'Invalid refresh token.' });
    }
});

// Logout
router.post('/logout', async (req, res) => {
    try {
        res.clearCookie('accessToken', {
            path: '/',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            secure: process.env.NODE_ENV === 'production'
        });
        res.clearCookie('refreshToken', {
            path: '/',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            secure: process.env.NODE_ENV === 'production'
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Logout failed.' });
    }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT id, email, first_name, last_name, role FROM users WHERE id = $1', [req.user.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user.' });
    }
});

module.exports = router;