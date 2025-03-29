const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
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
const userController = require('../controller/userController'); 


// --- Apply Middleware to Protect Routes Below ---
router.get('/login', (req, res) => {
    res.render('adminLogin', { errors: [] }); // Pass an empty errors array by default
});

// Admin Login Route (POST)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const admin = await User.findOne({ where: { email, role: 'admin' } });

        if (!admin) {
            return res.status(401).render('adminLogin', { 
                errors: [{ msg: 'Invalid credentials' }]  // Pass errors array if admin not found
            });
        }

        const isPasswordMatch = await bcrypt.compare(password, admin.password);
        if (!isPasswordMatch) {
            return res.status(401).render('adminLogin', { 
                errors: [{ msg: 'Invalid credentials' }]  // Pass errors array if password is incorrect
            });
        }

        // If login is successful, generate JWT token and redirect to dashboard
        const token = jwt.sign({ id: admin.id, role: admin.role }, JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true, maxAge: 3600000 });
        return res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Error logging in admin:', error);
        res.status(500).render('adminLogin', { 
            errors: [{ msg: 'Internal server error, please try again later' }]  // Handle server errors
        });
    }
});


// Apply middleware AFTER login routes
router.use(verifyAdmin);

// --- Admin: Dashboard Route ---
// Change admin dashboard route to use raw SQL
// --- Admin: Dashboard Route ---
router.get('/dashboard', async (req, res) => {
    try {
        // Query to fetch courses and instructor data
        const [courses] = await db.query(`
            SELECT c.id as course_id, c.title, c.instructor_id, u.name as instructor_name 
            FROM courses c
            JOIN users u ON c.instructor_id = u.id
        `);

        // Fetching users and passing courses, users, and message to the dashboard
        const [users] = await db.query(`SELECT id, name, email, role FROM users`);

        // Fetch message from query string (if exists)
        const { message } = req.query;

        res.render('adminDashboard', { courses, users, message });  // Fixed: Now message is properly fetched
    } catch (err) {
        console.error('Error fetching courses and users:', err);
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
router.post('/admin/deleteCourse/:id', async (req, res) => {
    const courseId = req.params.id;

    try {
        // Begin a transaction to delete course and related entries
        const connection = await db.getConnection();
        await connection.beginTransaction();

        // Delete from course_videos and course_notes (cascade would handle these too)
        await connection.query(`DELETE FROM course_videos WHERE course_id = ?`, [courseId]);
        await connection.query(`DELETE FROM course_notes WHERE course_id = ?`, [courseId]);
        await connection.query(`DELETE FROM enrollments WHERE course_id = ?`, [courseId]);
        await connection.query(`DELETE FROM course_progress WHERE course_id = ?`, [courseId]);
        
        // Finally, delete from the courses table
        await connection.query(`DELETE FROM courses WHERE id = ?`, [courseId]);

        // Commit transaction after successful deletions
        await connection.commit();
        connection.release();

        res.redirect('/admin/courses'); // Redirect to admin course list after deletion
    } catch (error) {
        console.error("Error deleting course:", error);

        if (connection) {
            await connection.rollback(); // Roll back changes if any error occurs
            connection.release();
        }

        res.status(500).send("Error deleting course. Please try again.");
    }
});




module.exports = router;
