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

// POST: Handle course creation with image upload
router.post('/create-course', verifyToken, upload.fields([
    { name: 'videos', maxCount: 5 },
    { name: 'notes', maxCount: 5 },
    { name: 'image', maxCount: 1 } // Add image field here
]), async (req, res) => {
    try {
        const { courseTitle, description } = req.body;
        const instructorId = req.user.id;

        // Handle image upload (default image if none uploaded)
        const image = req.files.image ? `/uploads/${req.files.image[0].filename}` : '/uploads/default.jpg';

        // Insert course into the courses table
        const [courseResult] = await db.query(
            'INSERT INTO courses (instructor_id, title, description, image) VALUES (?, ?, ?, ?)',
            [instructorId, courseTitle, description, image]
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

        req.flash('success', 'Course created successfully!');
        res.status(200).json({ success: true, message: 'Course created successfully!' });
    } catch (error) {
        console.error('Create Course Error:', error);
        req.flash('error', 'Failed to create course');
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
            user: req.user,
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

// GET: Load edit course form
router.get('/edit-course/:courseId', verifyToken, async (req, res) => {
    try {
        // Fetch course details
        const [courseResult] = await db.query('SELECT * FROM courses WHERE id = ?', [req.params.courseId]);
        
        if (!courseResult.length) {
            return res.status(404).send('Course not found.');
        }

        // Verify the instructor owns this course
        if (courseResult[0].instructor_id !== req.user.id) {
            req.flash('error', 'You do not have permission to edit this course.');
            return res.redirect('/instructor/dashboard');
        }

        // Fetch videos and notes associated with the course
        const [videosResult] = await db.query('SELECT video_url FROM course_videos WHERE course_id = ?', [req.params.courseId]);
        const [notesResult] = await db.query('SELECT id, note_url FROM course_notes WHERE course_id = ?', [req.params.courseId]);

        // Render the edit form
        res.render('editCourse', { 
            course: courseResult[0],
            videos: videosResult.map(v => v.video_url),
            notes: notesResult,
            messages: req.flash()
        });
    } catch (error) {
        console.error('Error fetching course:', error);
        req.flash('error', 'Failed to load course.');
        res.redirect('/instructor/dashboard');
    }
});

// View Enrolled Students Route
router.get('/view-enrolled-students/:courseId', async (req, res) => {
    const { courseId } = req.params;

    try {
        // Fetch course details
        const [course] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);
        if (course.length === 0) {
            return res.status(404).send('Course not found');
        }

        // Fetch enrolled students
        const [students] = await db.query(`
            SELECT users.id, users.name, users.email 
            FROM enrollments 
            JOIN users ON enrollments.user_id = users.id 
            WHERE enrollments.course_id = ?`, [courseId]);

        res.render('viewStudents', { course: course[0], students });
    } catch (error) {
        console.error('Error fetching enrolled students:', error);
        res.status(500).send('Server error.');
    }
});

// PUT: Update course details
router.put('/update-course/:courseId', verifyToken, upload.fields([
    { name: 'videos', maxCount: 5 },
    { name: 'notes', maxCount: 5 }
]), async (req, res) => {
    const { courseId } = req.params;
    const { title, description, deletedNotes, deletedVideos } = req.body;
    
    try {
        // 1. Update course basic info
        await db.query(
            'UPDATE courses SET title = ?, description = ? WHERE id = ? AND instructor_id = ?',
            [title, description, courseId, req.user.id]
        );
        
        // 2. Handle deleted notes if any
        if (deletedNotes && deletedNotes.length > 0) {
            const notesToDelete = deletedNotes.split(',');
            for (const noteId of notesToDelete) {
                if (noteId) {
                    // Get the file path before deleting from DB
                    const [noteResult] = await db.query('SELECT note_url FROM course_notes WHERE id = ?', [noteId]);
                    if (noteResult.length > 0) {
                        // Delete file from filesystem
                        try {
                            await fs.unlink(path.join(__dirname, '../uploads', noteResult[0].note_url));
                        } catch (err) {
                            console.error('Error deleting note file:', err);
                        }
                        // Delete from database
                        await db.query('DELETE FROM course_notes WHERE id = ?', [noteId]);
                    }
                }
            }
        }
        
        // 3. Handle deleted videos if any
        if (deletedVideos && deletedVideos.length > 0) {
            const videosToDelete = deletedVideos.split(',');
            for (const videoPath of videosToDelete) {
                if (videoPath) {
                    // Delete file from filesystem
                    try {
                        await fs.unlink(path.join(__dirname, '../uploads', videoPath));
                    } catch (err) {
                        console.error('Error deleting video file:', err);
                    }
                    // Delete from database
                    await db.query('DELETE FROM course_videos WHERE video_url = ?', [videoPath]);
                }
            }
        }
        
        // 4. Upload new files if any
        if (req.files) {
            // Handle new videos
            if (req.files.videos) {
                for (const video of req.files.videos) {
                    await db.query(
                        'INSERT INTO course_videos (course_id, video_url, title) VALUES (?, ?, ?)',
                        [courseId, video.filename, path.basename(video.originalname, path.extname(video.originalname))]
                    );
                }
            }
            
            // Handle new notes
            if (req.files.notes) {
                for (const note of req.files.notes) {
                    await db.query(
                        'INSERT INTO course_notes (course_id, note_url) VALUES (?, ?)',
                        [courseId, note.filename]
                    );
                }
            }
        }
        
        req.flash('success', 'Course updated successfully');
        res.redirect('/instructor/dashboard');
    } catch (error) {
        console.error('Update error:', error);
        req.flash('error', 'Failed to update course');
        res.redirect(`/instructor/edit-course/${courseId}`);
    }
});

module.exports = router;