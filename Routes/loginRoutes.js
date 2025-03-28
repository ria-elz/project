const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const userModel = require('../model/userModel');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Render login and register pages
router.get('/login', (req, res) => res.render('login', { 
    errors: [],
    message: req.flash('message') 
}));

router.get('/register', (req, res) => res.render('register', { 
    errors: [], 
    name: '', 
    email: '' 
}));

router.get('/admin/login', (req, res) => res.render('adminLogin', { 
    errors: [] 
}));

// Registration logic
router.post('/register', [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('role').notEmpty().withMessage('Role is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('register', { 
            errors: errors.array(), 
            name: req.body.name, 
            email: req.body.email 
        });
    }

    try {
        const { name, email, password, role } = req.body;
        const existingUser = await userModel.getUserByEmail(email);
        
        if (existingUser) {
            return res.render('register', { 
                errors: [{ msg: 'User already exists. Please log in.' }], 
                name, 
                email 
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await userModel.registerUser(name, email, hashedPassword, role);
        req.flash('message', 'Registration successful! Please login.');
        res.redirect('/login');
    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).render('register', { 
            errors: [{ msg: "Server error. Please try again later." }],
            name: req.body.name,
            email: req.body.email
        });
    }
});

// Login logic
router.post('/login', [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('login', { 
            errors: errors.array() 
        });
    }

    try {
        const { email, password } = req.body;
        const user = await userModel.getUserByEmail(email);
        
        if (!user) {
            return res.render('login', { 
                errors: [{ msg: "Invalid credentials" }] 
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('login', { 
                errors: [{ msg: "Invalid credentials" }] 
            });
        }

        const token = jwt.sign({ 
            id: user.id, 
            name: user.name, 
            role: user.role 
        }, JWT_SECRET, { expiresIn: '1h' });

        res.cookie('token', token, { 
            httpOnly: true,
            maxAge: 3600000 // 1 hour
        });
        
        // Set user in session
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        // Role-based redirect
        switch(user.role) {
            case 'admin':
                return res.redirect('/admin/dashboard');
            case 'instructor':
                return res.redirect('/instructor/dashboard');
            default:
                return res.redirect('/home');
        }
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).render('login', { 
            errors: [{ msg: "Server error. Please try again." }] 
        });
    }
});

// Admin login
router.post('/admin/login', [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userModel.getUserByEmail(email);

        if (!user || user.role !== 'admin') {
            return res.render('adminLogin', { 
                errors: [{ msg: "Invalid admin credentials" }] 
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('adminLogin', { 
                errors: [{ msg: "Invalid admin credentials" }] 
            });
        }

        const token = jwt.sign({ 
            id: user.id, 
            name: user.name, 
            role: user.role 
        }, JWT_SECRET, { expiresIn: '1h' });

        res.cookie('token', token, { 
            httpOnly: true,
            maxAge: 3600000
        });
        
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error("Admin Login Error:", err);
        res.status(500).render('adminLogin', { 
            errors: [{ msg: "Server error" }] 
        });
    }
});

module.exports = router;