const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../config/db');
const fs = require('fs').promises;
const { verifyToken } = require('../middleware/authMiddleware');
const methodOverride = require('method-override');

// Method override middleware to support PUT and DELETE methods
router.use(methodOverride('_method'));

// Configure file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            await fs.mkdir('./uploads', { recursive: true });
            cb(null, './uploads');
        } catch (err) {
            cb(err, null);
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|mp4|avi|mkv|pdf|doc|docx/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Error: Only document, image, and video files are allowed!'));
        }
    }
});

// GET: Show create course form
router.get('/create-course', verifyToken, (req, res) => {
    res.render('createCourse', { 
        user: req.user,
        messages: req.flash() 
    });
});

// POST: Handle course creation
router.post('/create-course', verifyToken, upload.fields([
    { name: 'videos', maxCount: 5 },
    { name: 'notes', maxCount: 5 }
]), async (req, res) => {
    try {
        const { courseTitle, description } = req.body;
        const instructorId = req.user.id;

        // Insert course into the courses table
        const [courseResult] = await db.query(
            'INSERT INTO courses (instructor_id, title, description) VALUES (?, ?, ?)',
            [instructorId, courseTitle, description]
        );
        const courseId = courseResult.insertId;

        // Insert videos into course_videos
        if (req.files.videos) {
            await Promise.all(
                req.files.videos.map(async (video) => {
                    await db.query(
                        'INSERT INTO course_videos (course_id, video_url) VALUES (?, ?)',
                        [courseId, video.filename]
                    );
                })
            );
        }

        // Insert notes into course_notes
        if (req.files.notes) {
            await Promise.all(
                req.files.notes.map(async (note) => {
                    await db.query(
                        'INSERT INTO course_notes (course_id, note_url) VALUES (?, ?)',
                        [courseId, note.filename]
                    );
                })
            );
        }

        res.json({ success: true, courseId });
    } catch (error) {
        console.error('Create Course Error:', error);
        res.status(500).json({ success: false, error: 'Failed to create course' });
    }
});

// GET: Instructor dashboard with courses
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        const [courses] = await db.query(`
            SELECT 
                c.*,
                COALESCE((SELECT JSON_ARRAYAGG(video_url) FROM course_videos WHERE course_id = c.id), '[]') AS videos,
                COALESCE((SELECT JSON_ARRAYAGG(note_url) FROM course_notes WHERE course_id = c.id), '[]') AS notes
            FROM courses c
            WHERE c.instructor_id = ?
            ORDER BY c.created_at DESC
        `, [req.user.id]);

        const parsedCourses = courses.map(course => ({
            ...course,
            videos: JSON.parse(course.videos),
            notes: JSON.parse(course.notes)
        }));

        res.render('instructorDashboard', {
            courses: parsedCourses,
            messages: req.flash()
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        req.flash('error', 'Failed to load dashboard');
        res.redirect('/login');
    }
});

// DELETE: Delete course
router.delete('/course/:id', verifyToken, async (req, res) => {
    const courseId = req.params.id;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Get files to delete
        const [videos] = await connection.query(
            'SELECT video_url FROM course_videos WHERE course_id = ?', [courseId]
        );
        const [notes] = await connection.query(
            'SELECT note_url FROM course_notes WHERE course_id = ?', [courseId]
        );

        // Delete related records
        await connection.query('DELETE FROM enrollments WHERE course_id = ?', [courseId]);
        await connection.query('DELETE FROM course_videos WHERE course_id = ?', [courseId]);
        await connection.query('DELETE FROM course_notes WHERE course_id = ?', [courseId]);
        await connection.query('DELETE FROM courses WHERE id = ? AND instructor_id = ?', 
            [courseId, req.user.id]);

        // Delete physical files
        const uploadDir = path.join(__dirname, '../uploads');
        await Promise.all([
            ...videos.map(v => fs.unlink(path.join(uploadDir, v.video_url))),
            ...notes.map(n => fs.unlink(path.join(uploadDir, n.note_url)))
        ]);

        await connection.commit();
        req.flash('success', 'Course deleted successfully');
        res.redirect('/instructor/dashboard');
    } catch (error) {
        await connection.rollback();
        console.error('Delete error:', error);
        req.flash('error', 'Failed to delete course');
        res.redirect('/instructor/dashboard');
    } finally {
        connection.release();
    }
});

module.exports = router;
