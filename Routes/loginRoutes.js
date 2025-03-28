const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const userModel = require('../model/userModel');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Render login and register pages
router.get('/login', (req, res) => res.render('login', { errors: [] }));
router.get('/register', (req, res) => res.render('register', { errors: [], name: '', email: '' }));

// Handle registration
router.post('/register', [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('role').notEmpty().withMessage('Role is required')  // Validate role
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('register', { errors: errors.array(), name: req.body.name, email: req.body.email });
    }

    const { name, email, password, role } = req.body;
    try {
        const existingUser = await userModel.getUserByEmail(email);
        if (existingUser) {
            return res.render('register', { errors: [{ msg: 'User already exists. Please log in.' }], name, email });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await userModel.registerUser(name, email, hashedPassword, role);
        res.redirect('/login');
    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).send("Server error.");
    }
});

// Handle login
router.post('/login', [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.render('login', { errors: errors.array() });

    const { email, password } = req.body;
    try {
        const user = await userModel.getUserByEmail(email);
        if (!user) return res.render('login', { errors: [{ msg: "Invalid email or password" }] });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.render('login', { errors: [{ msg: "Invalid email or password" }] });

        const token = jwt.sign({ id: user.id, name: user.name }, JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true });
        req.session.user = user;
        res.redirect('/home');
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).send("Server error.");
    }
});

module.exports = router;
