const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Ensure this is the correct path
const { verifyToken } = require('../middleware/authMiddleware');

// 🔹 Fetch All Available Courses
router.get('/', async (req, res) => {
    try {
        const [courses] = await db.query('SELECT * FROM courses');
        res.render('courses', { courses });
    } catch (err) {
        console.error('Error fetching courses:', err);
        res.status(500).send('Server error.');
    }
});

// 🔹 Enroll in a Course
router.post('/enroll/:courseId', async (req, res) => {
    const { courseId } = req.params;

    if (!req.session || !req.session.user) {
        return res.status(401).send('Unauthorized: Please log in to enroll.');
    }

    const userId = req.session.user.id; // Ensure user is logged in

    try {
        await db.query(
            'INSERT INTO enrollments (user_id, course_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE enrolled_at = CURRENT_TIMESTAMP',
            [userId, courseId]
        );

        res.redirect('/home');
    } catch (err) {
        console.error('Error enrolling in course:', err);
        res.status(500).send('Server error.');
    }
});

// 🔹 View Course Content (Videos & Notes)
router.get('/course/:id', verifyToken, async (req, res) => {
    try {
        const [course] = await db.query('SELECT * FROM courses WHERE id = ?', [req.params.id]);

        if (!course.length) {
            return res.status(404).send('Course not found.');
        }

        // Get videos and notes for the course
        const [videos] = await db.query('SELECT * FROM course_videos WHERE course_id = ?', [req.params.id]);
        const [notes] = await db.query('SELECT * FROM course_notes WHERE course_id = ?', [req.params.id]);

        res.render('studentCourseView', {
            course: course[0],
            videos,
            notes,
            messages: req.flash(),
        });
    } catch (error) {
        console.error('Course view error:', error);
        res.status(500).send('Server Error');
    }
});

// 🔹 Search Courses
router.get('/search-courses', async (req, res) => {
    const searchQuery = req.query.q;

    if (!searchQuery) {
        return res.json([]); // Return an empty array if no query is provided
    }

    try {
        const [results] = await db.query('SELECT title FROM courses WHERE title LIKE ?', [`%${searchQuery}%`]);
        res.json(results);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
