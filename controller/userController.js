const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// User Registration
const userAdd = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "User already exists. Please login instead." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();

        res.status(201).redirect('/login');
    } catch (err) {
        console.error("Error registering user:", err);
        res.status(500).json({ error: "Server error during registration" });
    }
};

// User Login
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign({ id: user._id, name: user.name }, JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true });
        req.session.token = token;
        req.session.user = user;

        return res.redirect('/home');
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Server error, please try again" });
    }
};

// Update User Function
const updateUser = async (req, res) => {
    try {
        const { id, name } = req.body;

        if (!id || !name) {
            return res.status(400).json({ error: "User ID and name are required" });
        }

        const user = await User.findByIdAndUpdate(id, { name }, { new: true });
        if (req.session.user && req.session.user._id == id) {
            req.session.user.name = user.name;
        }

        res.status(200).redirect('/home');
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Error updating user" });
    }
};

// Export the Functions
module.exports = {
    userAdd,
    loginUser,
    updateUser
};
