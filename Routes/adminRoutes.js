const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
    getAllUsers,
    deleteUserByAdmin,
    addUserByAdmin,
    addCourseByAdmin,
    deleteCourse,
} = require('../controller/userController');

const { verifyAdmin } = require('../middleware/authMiddleware');
const { Course } = require('../model/courseModel');
const { User } = require('../model/userModel');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'; 



// --- Apply Middleware to Protect Routes Below ---
router.get('/login', (req, res) => {
    res.render('adminLogin'); // Login page accessible without authentication
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if admin exists in the database with role = 'admin'
        const admin = await User.findOne({ where: { email, role: 'admin' } });

        if (!admin) {
            return res.status(401).render('adminLogin', { error: 'Invalid credentials' });
        }

        // Compare entered password with the hashed password in DB
        const isPasswordMatch = await bcrypt.compare(password, admin.password);
        if (!isPasswordMatch) {
            return res.status(401).render('adminLogin', { error: 'Invalid credentials' });
        }

        // Generate a token on successful login
        const token = jwt.sign({ id: admin.id, role: admin.role }, JWT_SECRET, { expiresIn: '1h' });

        // Store token in cookies and redirect to admin dashboard
        res.cookie('token', token, { httpOnly: true, maxAge: 3600000 });
        return res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Error logging in admin:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Apply middleware AFTER login routes
router.use(verifyAdmin);

// --- Admin: Dashboard Route ---
// Change admin dashboard route to use raw SQL
router.get('/dashboard', async (req, res) => {
    try {
        const [courses] = await db.query(`
            SELECT c.*, u.name as instructor_name 
            FROM courses c
            JOIN users u ON c.instructor_id = u.id
        `);
        res.render('admin-dashboard', { courses });
    } catch (err) {
        console.error('Error fetching dashboard:', err);
        res.status(500).send('Server Error');
    }
});

// --- Admin: Add New User Route ---
router.post('/addUser', async (req, res) => {
    try {
        const result = await addUserByAdmin(req, res); // Call addUserByAdmin function

        if (result && !res.headersSent) {
            return res.redirect('/admin/dashboard?message=User+added+successfully');
        }
    } catch (error) {
        console.error("Error adding user by admin:", error);
        if (!res.headersSent) {
            return res.status(500).send('Internal Server Error');
        }
    }
});

// --- Admin: Delete User Route ---
router.delete('/deleteUser/:userId', async (req, res) => {
    try {
        await deleteUserByAdmin(req, res); // Handle user deletion logic

    } catch (error) {
        console.error('Error deleting user:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Unexpected error during user deletion' });
        }
    }
});

// --- Admin: Add a Course Route ---
router.post('/admin/add-course', async (req, res) => {
    const { title, description, instructor_id } = req.body;

    try {
        const instructor = await User.findByPk(instructor_id); // Find the instructor

        if (!instructor) return res.status(400).send('Invalid instructor');

        await Course.create({
            title,
            description,
            instructor_id, // Associate course with instructor
        });

        res.redirect('/admin/dashboard'); // Redirect to dashboard on success
    } catch (error) {
        console.error('Error adding course:', error);
        res.status(500).send('Failed to add course');
    }
});

// --- Admin: Delete a Course Route ---
router.post('/admin/delete-course/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const course = await Course.findByPk(id); // Check if course exists

        if (!course) return res.status(404).send('Course not found');

        await course.destroy(); // Delete the course
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Error deleting course:', error);
        res.status(500).send('Failed to delete course');
    }
});


module.exports = router;
