const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Verify Admin Middleware
const verifyAdmin = (req, res, next) => {
    // Check for token in cookies or authorization header
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(403).render('adminLogin', { error: 'Access Denied: No token provided' });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check if user is an admin
        if (decoded.role !== 'admin') {
            return res.status(403).render('adminLogin', { error: 'Access Denied: Admin rights required' });
        }

        // Attach user info to request object
        req.user = decoded;
        next();
    } catch (error) {
        // Token is invalid or expired
        return res.status(401).render('adminLogin', { error: 'Invalid or expired token' });
    }
};

// Verify Instructor Middleware
const verifyInstructor = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) return res.redirect('/login');

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.role !== 'instructor') return res.status(403).send('Access Denied: Instructors Only');

        req.user = decoded;
        next();
    } catch (error) {
        console.error("Authorization Error:", error);
        res.status(401).redirect('/login');
    }
};

// Verify Student Middleware
const verifyStudent = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) return res.redirect('/login');

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.role !== 'student') return res.status(403).send('Access Denied: Students Only');

        req.user = decoded;
        next();
    } catch (error) {
        console.error("Authorization Error:", error);
        res.status(401).redirect('/login');
    }
};

// authMiddleware.js (enhanced verification)
const verifyToken = (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.redirect('/login');

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error("Token verification failed:", error);
        res.clearCookie('token');
        return res.redirect('/login');
    }
};

module.exports = { verifyAdmin, verifyInstructor, verifyStudent, verifyToken };