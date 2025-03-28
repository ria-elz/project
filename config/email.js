const nodemailer = require('nodemailer');
require('dotenv').config();  // Load environment variables from .env

// Nodemailer transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',  // You can change this to your email service provider (e.g., Outlook, Yahoo)
    auth: {
        user: process.env.EMAIL_USER,  // Your email address (from .env file)
        pass: process.env.EMAIL_PASS   // Your app-specific password (from .env file)
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error("SMTP Connection Error:", error);
    
    }
});

module.exports = transporter;
