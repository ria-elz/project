const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Database connection
require('./config/db');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
app.use(flash());

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make user and messages available to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.messages = req.flash();
    next();
});

// Routes
const loginRoutes = require('./Routes/loginRoutes');
const adminRoutes = require('./Routes/adminRoutes');
const instructorRoutes = require('./Routes/instructorRoutes');
const studentRoutes = require('./Routes/studentRoutes');

app.use('/', loginRoutes);
app.use('/admin', adminRoutes);
app.use('/instructor', instructorRoutes);
app.use('/student', studentRoutes);

// Basic routes
app.get('/', (req, res) => res.render('index'));
app.get('/home', (req, res) => res.render('home'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        message: 'Something went wrong!',
        user: req.session.user || null
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { 
        user: req.session.user || null 
    });
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        message: err.message || 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});