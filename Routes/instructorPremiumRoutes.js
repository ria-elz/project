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

// POST: Handle course creation with premium video option
router.post('/create-course', verifyToken, upload.fields([
    { name: 'videos', maxCount: 5 },
    { name: 'notes', maxCount: 5 }
]), async (req, res) => {
    try {
        const { courseTitle, description, isPremium } = req.body;
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
                        'INSERT INTO course_videos (course_id, video_url, is_premium) VALUES (?, ?, ?)',
                        [courseId, video.filename, !!isPremium]
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

module.exports = router;