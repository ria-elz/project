// studentRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');
const progressTracking = require('../middleware/progressTracking');
const path = require('path');
const fs = require('fs');

const {
    getUploadedContent,
    enrollInCourse,
    trackProgress,
} = require('../controller/userController');

// 🔹 Fetch Course Categories
// 🔹 Fetch Course Categories
router.get('/categories', verifyToken, async (req, res) => {
    try {
        const [courses] = await db.query(`
            SELECT c.*, u.name AS instructor_name, c.image AS course_image, 
                   (SELECT JSON_ARRAYAGG(JSON_OBJECT('video_url', cv.video_url))
                    FROM course_videos cv WHERE cv.course_id = c.id) AS videos,
                   (SELECT JSON_ARRAYAGG(JSON_OBJECT('note_url', cn.note_url))
                    FROM course_notes cn WHERE cn.course_id = c.id) AS notes
            FROM courses c
            JOIN users u ON c.instructor_id = u.id
        `);

        const [enrollments] = await db.query(
            "SELECT course_id FROM enrollments WHERE user_id = ?",
            [req.user.id]
        );
        const enrolledCourseIds = enrollments.map(e => e.course_id);

        const coursesWithEnrollment = courses.map(course => ({
            ...course,
            isEnrolled: enrolledCourseIds.includes(course.id),
            videos: typeof course.videos === 'string' ? JSON.parse(course.videos) : (course.videos || []),
            notes: typeof course.notes === 'string' ? JSON.parse(course.notes) : (course.notes || []),
            image: course.course_image // Add the image field here
        }));

        res.render('studentCategories', { courses: coursesWithEnrollment, user: req.user });
    } catch (error) {
        console.error("Error fetching courses:", error);
        res.status(500).send("Server error.");
    }
});

// 🔹 Fetch Student Courses
router.get('/student/courses', (req, res) => {
    db.query('SELECT * FROM courses', (err, courses) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.render('studentCategories', { courses });
    });
});

// 🔹 Serve Video Player Page
router.get('/watch/:videoFilename', (req, res) => {
    res.render('watchVideo', { videoFilename: req.params.videoFilename });
});

// 🔹 Stream Course Videos
router.get('/course/:courseId/video/:videoId', verifyToken, progressTracking.trackProgress, async (req, res) => {
    try {
        const [video] = await db.query(
            `SELECT video_url FROM course_videos WHERE id = ? AND course_id = ?`,
            [req.params.videoId, req.params.courseId]
        );

        if (!video.length) {
            return res.status(404).send('Video not found');
        }

        res.sendFile(video[0].video_url, { root: './uploads' });

    } catch (error) {
        console.error('Video streaming error:', error);
        res.status(500).send('Server error');
    }
});

// 🔹 Download Course Notes
router.get('/course/:courseId/note/:noteId', verifyToken, progressTracking.trackProgress, async (req, res) => {
    try {
        const [note] = await db.query(
            `SELECT note_url FROM course_notes WHERE id = ? AND course_id = ?`,
            [req.params.noteId, req.params.courseId]
        );

        if (!note.length) {
            return res.status(404).send('Note not found');
        }

        res.download(`./uploads/${note[0].note_url}`);

    } catch (error) {
        console.error('Note download error:', error);
        res.status(500).send('Server error');
    }
});

// 🔹 Video Playback Page
router.get('/student/course/:courseId/video/:videoId', verifyToken, async (req, res) => {
    try {
        const [video] = await db.query(
            `SELECT * FROM course_videos WHERE id = ? AND course_id = ?`,
            [req.params.videoId, req.params.courseId]
        );

        if (!video.length) {
            return res.status(404).send('Video not found');
        }

        res.render('videoPlayer', {
            video: video[0],
            user: req.user
        });
    } catch (error) {
        console.error('Video playback error:', error);
        res.status(500).send('Server Error');
    }
});

// 🔹 Video Route with Verification
router.get('/student/video/:filename', verifyToken, (req, res) => {
    const filename = req.params.filename;
    const videoPath = path.join(__dirname, '../uploads', filename);

    fs.access(videoPath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error('Video file not found:', filename);
            return res.status(404).send('Video not found');
        }

        res.render('videoPlayer', {
            videoUrl: `/uploads/${filename}`,
            filename: filename
        });
    });
});

// 🔹 Enroll in a Course
router.post('/enroll', verifyToken, enrollInCourse);

// 🔹 Track Course Progress
router.put('/track-progress', trackProgress);

module.exports = router;
