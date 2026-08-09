const express = require('express');
const router = express.Router();

const db = require('../config/db');
const { hashPassword } = require('../services/auth');
const { authenticate, adminOnly } = require('../middlewares/auth');
const logger = require('../logger');

// All routes in this file require authentication and admin privileges.
router.use(authenticate);
router.use(adminOnly);

// ========================================
// GET /api/admin/users
// List users
// ========================================
router.get('/users', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT
                id,
                email,
                first_name,
                last_name,
                role,
                status,
                last_login,
                created_at,
                updated_at
            FROM users
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            users: rows
        });
    } catch (error) {
        logger.error(`Admin failed to fetch users: ${error.message}`);

        res.status(500).json({
            error: 'Failed to fetch users.'
        });
    }
});

// ========================================
// POST /api/admin/users
// Create user
// ========================================
router.post('/users', async (req, res) => {
    const {
        email,
        password,
        first_name,
        last_name,
        role = 'user'
    } = req.body;

    if (!email || !password || !first_name || !last_name) {
        return res.status(400).json({
            error: 'Email, password, first name, and last name are required.'
        });
    }

    const allowedRoles = ['user', 'auditor', 'admin'];

    if (!allowedRoles.includes(role)) {
        return res.status(400).json({
            error: 'Invalid role.'
        });
    }

    if (password.length < 12) {
        return res.status(400).json({
            error: 'Password must be at least 12 characters long.'
        });
    }

    try {
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase().trim()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: 'A user with this email already exists.'
            });
        }

        const passwordHash = await hashPassword(password);

        const { rows } = await db.query(
            `
            INSERT INTO users (
                email,
                password_hash,
                first_name,
                last_name,
                role,
                status
            )
            VALUES ($1, $2, $3, $4, $5, 'active')
            RETURNING
                id,
                email,
                first_name,
                last_name,
                role,
                status,
                created_at
            `,
            [
                email.toLowerCase().trim(),
                passwordHash,
                first_name.trim(),
                last_name.trim(),
                role
            ]
        );

        const newUser = rows[0];

        await db.query(
            `
            INSERT INTO audit_logs (
                user_id,
                action,
                resource,
                details,
                ip_address
            )
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                req.user.id,
                'create_user',
                'users',
                JSON.stringify({
                    created_user_id: newUser.id,
                    email: newUser.email,
                    role: newUser.role
                }),
                req.ip
            ]
        );

        res.status(201).json({
            success: true,
            user: newUser
        });
    } catch (error) {
        logger.error(`Admin failed to create user: ${error.message}`);

        res.status(500).json({
            error: 'Failed to create user.'
        });
    }
});

// ========================================
// PATCH /api/admin/users/:id/status
// Change user status
// ========================================
router.patch('/users/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['active', 'suspended', 'deleted'];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            error: 'Invalid status.'
        });
    }

    try {
        const { rows } = await db.query(
            `
            UPDATE users
            SET status = $1
            WHERE id = $2
            RETURNING
                id,
                email,
                first_name,
                last_name,
                role,
                status,
                updated_at
            `,
            [status, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'User not found.'
            });
        }

        await db.query(
            `
            INSERT INTO audit_logs (
                user_id,
                action,
                resource,
                details,
                ip_address
            )
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                req.user.id,
                'change_user_status',
                'users',
                JSON.stringify({
                    target_user_id: Number(id),
                    status
                }),
                req.ip
            ]
        );

        res.json({
            success: true,
            user: rows[0]
        });
    } catch (error) {
        logger.error(`Admin failed to change user status: ${error.message}`);

        res.status(500).json({
            error: 'Failed to change user status.'
        });
    }
});

module.exports = router;