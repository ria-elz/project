const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const {
    getAllUsers,
    deleteUserByAdmin,
    addUserByAdmin,
    addCourseByAdmin
} = require('../controller/userController');
const { verifyAdmin } = require('../middleware/authMiddleware');
const { Course } = require('../model/courseModel');
const { User } = require('../model/userModel');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';



// --- Apply Middleware to Protect Routes Below ---
router.get('/login', (req, res) => {
    res.render('adminLogin', { errors: [] }); // Pass an empty errors array by default
});

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
        const [courses] = await db.query(`
            SELECT c.id as course_id, c.title, c.instructor_id, u.name as instructor_name, c.created_at 
            FROM courses c
            JOIN users u ON c.instructor_id = u.id
        `);
        const [users] = await db.query(`SELECT id, name, email, role FROM users`);
        const { message } = req.query;
        res.render('adminDashboard', { courses, users, message });
    } catch (err) {
        console.error('Error fetching courses and users:', err);
        res.status(500).send('Server Error');
    }
});


// --- Admin: Add New User Route ---
router.post('/addUser', async (req, res) => {
    try {
        const result = await addUserByAdmin(req, res);
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
        await deleteUserByAdmin(req, res);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Unexpected error during user deletion' });
        }
    }
});

// --- Admin: Add a Course Route ---
// adminRoutes.js - Updated Add Course Route
// adminRoutes.js - Updated Add Course Route
router.post('/addCourse', async (req, res) => {
    // Extract fields using the correct names from the form
    const { title, description, instructorId } = req.body;
    try {
        // Validate required fields
        if (!title || !description || !instructorId) {
            return res.status(400).send('All fields are required.');
        }
        // Check if instructor exists and has the instructor role
        const [instructor] = await db.query(
            "SELECT * FROM users WHERE id = ? AND role = 'instructor'",
            [instructorId]
        );
        if (!instructor.length) {
            return res.status(400).send('Invalid instructor');
        }
        // Insert new course into the courses table
        await db.query(
            "INSERT INTO courses (title, description, instructor_id) VALUES (?, ?, ?)",
            [title, description, instructorId]
        );
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Error adding course:', error);
        res.status(500).send('Failed to add course');
    }
});


// --- Admin: Delete a Course Route ---
// In adminRoutes.js
// adminRoutes.js - DELETE Course Route with detailed logging
// adminRoutes.js - Updated DELETE Course Route
router.delete('/delete-course/:id', async (req, res) => {
    const courseId = req.params.id;
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        console.log(`Attempting to delete course with ID: ${courseId}`);

        // Delete related records
        const [videosResult] = await connection.query(`DELETE FROM course_videos WHERE course_id = ?`, [courseId]);
        console.log(`Deleted ${videosResult.affectedRows} video records.`);
        
        const [notesResult] = await connection.query(`DELETE FROM course_notes WHERE course_id = ?`, [courseId]);
        console.log(`Deleted ${notesResult.affectedRows} note records.`);
        
        const [enrollmentsResult] = await connection.query(`DELETE FROM enrollments WHERE course_id = ?`, [courseId]);
        console.log(`Deleted ${enrollmentsResult.affectedRows} enrollment records.`);
        
        const [progressResult] = await connection.query(`DELETE FROM course_progress WHERE course_id = ?`, [courseId]);
        console.log(`Deleted ${progressResult.affectedRows} progress records.`);
        
        // Delete the course record
        const [courseResult] = await connection.query(`DELETE FROM courses WHERE id = ?`, [courseId]);
        console.log('Delete course result:', courseResult);
        
        if (courseResult.affectedRows === 0) {
            throw new Error(`Course with ID ${courseId} was not found or could not be deleted.`);
        }

        await connection.commit();
        connection.release();
        console.log(`Course with ID ${courseId} deleted successfully.`);
        res.json({ message: 'Course deleted successfully' });
    } catch (error) {
        console.error("Error in DELETE /delete-course/:id", error);
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("Rollback error:", rollbackError);
            }
            connection.release();
        }
        res.status(500).json({ error: error.message });
    }
});



module.exports = router;
