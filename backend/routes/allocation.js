const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middlewares/auth');
const logger = require('../logger');

// Get allocation rules
router.get('/rules', authenticate, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT id, name, percentage, color, is_locked, is_auto 
       FROM allocation_rules WHERE user_id = $1 ORDER BY created_at ASC`,
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        logger.error(`Failed to fetch allocation rules: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch allocation rules.' });
    }
});

// Add a new allocation rule
router.post('/rules', authenticate, async (req, res) => {
    const { name, percentage, color = '#3D8EF0', isLocked = false, isAuto = true } = req.body;
    try {
        // Validate percentage
        if (percentage < 0 || percentage > 100) {
            return res.status(400).json({ error: 'Percentage must be between 0 and 100.' });
        }

        // Check if total percentage exceeds 100%
        const { rows: existingRules } = await db.query(
            'SELECT SUM(percentage) as total FROM allocation_rules WHERE user_id = $1',
            [req.user.id]
        );
        const total = parseFloat(existingRules[0].total) + percentage;
        if (total > 100 && !isLocked) {
            return res.status(400).json({ error: 'Total percentage cannot exceed 100%.', total });
        }

        const { rows } = await db.query(
            `INSERT INTO allocation_rules (user_id, name, percentage, color, is_locked, is_auto) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [req.user.id, name, percentage, color, isLocked, isAuto]
        );

        // Log action
        await db.query(
            `INSERT INTO audit_logs (user_id, action, resource, details, ip_address) 
       VALUES ($1, 'add_rule', 'allocation_rules', $2, $3)`,
            [req.user.id, JSON.stringify({ name, percentage }), req.ip]
        );

        res.json(rows[0]);
    } catch (error) {
        logger.error(`Failed to add allocation rule: ${error.message}`);
        res.status(500).json({ error: 'Failed to add allocation rule.' });
    }
});

// Update an allocation rule
router.patch('/rules/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { percentage } = req.body;
    try {
        if (percentage < 0 || percentage > 100) {
            return res.status(400).json({ error: 'Percentage must be between 0 and 100.' });
        }

        const { rows } = await db.query(
            `UPDATE allocation_rules SET percentage = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
            [percentage, id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Rule not found or not owned by user.' });
        }
        res.json(rows[0]);
    } catch (error) {
        logger.error(`Failed to update allocation rule: ${error.message}`);
        res.status(500).json({ error: 'Failed to update allocation rule.' });
    }
});

// Delete an allocation rule
router.delete('/rules/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await db.query(
            'DELETE FROM allocation_rules WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Rule not found or not owned by user.' });
        }

        // Log action
        await db.query(
            `INSERT INTO audit_logs (user_id, action, resource, details, ip_address) 
       VALUES ($1, 'delete_rule', 'allocation_rules', $2, $3)`,
            [req.user.id, JSON.stringify({ id }), req.ip]
        );

        res.json({ success: true });
    } catch (error) {
        logger.error(`Failed to delete allocation rule: ${error.message}`);
        res.status(500).json({ error: 'Failed to delete allocation rule.' });
    }
});

// Run allocation
router.post('/run', authenticate, async (req, res) => {
    const { amount, source = 'all' } = req.body;
    try {
        // Get allocation rules
        const { rows: rules } = await db.query(
            `SELECT id, name, percentage FROM allocation_rules 
       WHERE user_id = $1 AND is_auto = true ORDER BY created_at ASC`,
            [req.user.id]
        );

        // Validate total percentage
        const totalPercentage = rules.reduce((sum, rule) => sum + rule.percentage, 0);
        if (totalPercentage !== 100) {
            return res.status(400).json({
                error: `Total percentage must be 100%. Current total: ${totalPercentage}%`,
                rules,
            });
        }

        // Calculate allocations
        const allocations = rules.map(rule => ({
            ruleId: rule.id,
            ruleName: rule.name,
            amount: (amount * rule.percentage) / 100,
            percentage: rule.percentage,
        }));

        // Log allocation run
        await db.query(
            `INSERT INTO audit_logs (user_id, action, resource, details, ip_address) 
       VALUES ($1, 'run_allocation', 'allocation', $2, $3)`,
            [req.user.id, JSON.stringify({ amount, source, allocations }), req.ip]
        );

        res.json({ success: true, allocations });
    } catch (error) {
        logger.error(`Failed to run allocation: ${error.message}`);
        res.status(500).json({ error: 'Failed to run allocation.' });
    }
});

module.exports = router;