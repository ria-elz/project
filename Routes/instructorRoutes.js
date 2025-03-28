const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../config/db');
const fs = require('fs').promises;
const { verifyToken } = require('../middleware/authMiddleware');


// Configure file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdir('./uploads', { recursive: true }).then(() => {
            cb(null, './uploads');
        });
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
            cb('Error: Only document, image and video files are allowed!');
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

        // Process uploaded files
        const videos = req.files['videos']?.map(file => file.filename) || [];
        const notes = req.files['notes']?.map(file => file.filename) || [];

        // Insert into database
        const [result] = await db.query(
            'INSERT INTO courses (instructor_id, title, description, videos, notes) VALUES (?, ?, ?, ?, ?)',
            [
                instructorId,
                courseTitle,
                description,
                JSON.stringify(videos),
                JSON.stringify(notes)
            ]
        );

        // Return success response
        return res.json({ 
            success: true,
            courseId: result.insertId
        });

    } catch (error) {
        console.error('Create Course Error:', error);
        return res.status(500).json({ 
            success: false,
            error: 'Failed to create course'
        });
    }
});

// GET: Instructor dashboard with courses
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        const [courses] = await db.query(`
            SELECT 
                c.*,
                (SELECT COUNT(*) FROM course_videos WHERE course_id = c.id) AS video_count,
                (SELECT COUNT(*) FROM course_notes WHERE course_id = c.id) AS note_count
            FROM courses c
            WHERE c.instructor_id = ?
            ORDER BY c.created_at DESC
        `, [req.user.id]);

        res.render('instructorDashboard', {
            courses,
            messages: req.flash()
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        req.flash('error', 'Failed to load dashboard');
        res.redirect('/login');
    }
});
// View Enrolled Students with Progress
router.get('/view-enrolled-students/:courseId', verifyToken, async (req, res) => {
    try {
        const [course] = await db.query(`
            SELECT c.*, u.name as instructor_name 
            FROM courses c
            JOIN users u ON c.instructor_id = u.id
            WHERE c.id = ?
        `, [req.params.courseId]);

        const [students] = await db.query(`
            SELECT 
                u.id,
                u.name,
                u.email,
                (SELECT COUNT(DISTINCT video_id) 
                 FROM course_progress 
                 WHERE user_id = u.id 
                 AND course_id = ?
                 AND content_type = 'video') as videos_completed,
                (SELECT COUNT(DISTINCT note_id) 
                 FROM course_progress 
                 WHERE user_id = u.id 
                 AND course_id = ?
                 AND content_type = 'note') as notes_completed
            FROM users u
            INNER JOIN enrollments e ON u.id = e.user_id
            WHERE e.course_id = ?
        `, [req.params.courseId, req.params.courseId, req.params.courseId]);

        const totalVideos = course[0].videos ? JSON.parse(course[0].videos).length : 0;
        const totalNotes = course[0].notes ? JSON.parse(course[0].notes).length : 0;

        res.render('progress', {
            course: {
                ...course[0],
                videos: JSON.parse(course[0].videos || '[]'),
                notes: JSON.parse(course[0].notes || '[]')
            },
            students: students.map(student => ({
                ...student,
                video_progress: totalVideos > 0 ? 
                    Math.round((student.videos_completed / totalVideos) * 100) : 0,
                note_progress: totalNotes > 0 ? 
                    Math.round((student.notes_completed / totalNotes) * 100) : 0
            })),
            messages: req.flash()
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Server Error');
    }
});
// GET: Show edit course form
// In instructorRoutes.js
router.get('/edit-course/:id', verifyToken, async (req, res) => {
    try {
        const [course] = await db.query(`
            SELECT 
                c.*,
                COALESCE(
                    (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', id, 'video_url', video_url))
                     FROM course_videos 
                     WHERE course_id = c.id),
                    '[]'
                ) AS videos,
                COALESCE(
                    (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', id, 'note_url', note_url))
                     FROM course_notes 
                     WHERE course_id = c.id),
                    '[]'
                ) AS notes
            FROM courses c
            WHERE c.id = ? AND c.instructor_id = ?
        `, [req.params.id, req.user.id]);

        const parsedCourse = {
            ...course[0],
            videos: JSON.parse(course[0].videos),
            notes: JSON.parse(course[0].notes)
        };

        res.render('editCourse', {
            course: parsedCourse,
            messages: req.flash()
        });
    } catch (error) {
        console.error('Edit course error:', error);
        res.status(500).send('Server Error');
    }
});
// POST: Update course
// Update course route with file handling



router.post('/update-course/:id', 
    verifyToken, 
    upload.fields([
        { name: 'videos', maxCount: 5 },
        { name: 'notes', maxCount: 5 }
    ]),
    async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const { title, description, keep_videos = [], keep_notes = [], removed_videos = [], removed_notes = [] } = req.body;

            // 1. Update course details
            await connection.query(
                `UPDATE courses SET title = ?, description = ? WHERE id = ? AND instructor_id = ?`,
                [title, description, req.params.id, req.user.id]
            );

            // 2. Handle removed videos
            if (removed_videos.length > 0) {
                const [videoRecords] = await connection.query(
                    `SELECT video_url FROM course_videos WHERE id IN (?) AND course_id = ?`,
                    [removed_videos, req.params.id]
                );
                
                await connection.query(
                    `DELETE FROM course_videos WHERE id IN (?) AND course_id = ?`,
                    [removed_videos, req.params.id]
                );

                // Delete files from filesystem
                await Promise.all(
                    videoRecords.map(v => 
                        fs.unlink(path.join(__dirname, '../uploads', v.video_url))
                    )
                );
            }

            // 3. Handle removed notes
            if (removed_notes.length > 0) {
                const [noteRecords] = await connection.query(
                    `SELECT note_url FROM course_notes WHERE id IN (?) AND course_id = ?`,
                    [removed_notes, req.params.id]
                );
                
                await connection.query(
                    `DELETE FROM course_notes WHERE id IN (?) AND course_id = ?`,
                    [removed_notes, req.params.id]
                );

                // Delete files from filesystem
                await Promise.all(
                    noteRecords.map(n => 
                        fs.unlink(path.join(__dirname, '../uploads', n.note_url))
                    )
                );
            }

            // 4. Add new videos
            if (req.files.videos) {
                await Promise.all(
                    req.files.videos.map(async (file) => {
                        await connection.query(
                            `INSERT INTO course_videos (course_id, video_url) VALUES (?, ?)`,
                            [req.params.id, file.filename]
                        );
                    })
                );
            }

            // 5. Add new notes
            if (req.files.notes) {
                await Promise.all(
                    req.files.notes.map(async (file) => {
                        await connection.query(
                            `INSERT INTO course_notes (course_id, note_url) VALUES (?, ?)`,
                            [req.params.id, file.filename]
                        );
                    })
                );
            }

            await connection.commit();
            req.flash('success', 'Course updated successfully');
            res.redirect('/instructor/dashboard');

        } catch (error) {
            await connection.rollback();
            console.error('Update course error:', error);
            req.flash('error', 'Failed to update course');
            res.redirect(`/instructor/edit-course/${req.params.id}`);
        } finally {
            connection.release();
        }
    }
);
// DELETE: Delete course
// DELETE: Delete course
router.delete('/delete-course/:id', verifyToken, async (req, res) => {
    try {
        await db.query(`
            DELETE FROM courses 
            WHERE id = ? AND instructor_id = ?
        `, [req.params.id, req.user.id]);

        req.flash('success', 'Course deleted successfully');
        res.redirect('/instructor/dashboard');

    } catch (error) {
        console.error('Delete course error:', error);
        req.flash('error', 'Failed to delete course');
        res.redirect('/instructor/dashboard');
    }
});

module.exports = router;    