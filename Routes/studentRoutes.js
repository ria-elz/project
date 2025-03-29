// studentRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');
const progressTracking = require('../middleware/progressTracking');
const path = require('path');

const {
    getUploadedContent,
    enrollInCourse,     // Make sure this is properly defined in userController.js
    trackProgress,      // Also ensure this function exists and is exported from userController.js
} = require('../controller/userController');

router.get('/categories', async (req, res) => {
    try {
        const [courses] = await db.query(`
            SELECT 
              c.*,
              u.name AS instructor_name,
              (SELECT JSON_ARRAYAGG(JSON_OBJECT('video_url', video_url)) 
               FROM course_videos WHERE course_id = c.id) AS videos,
              (SELECT JSON_ARRAYAGG(JSON_OBJECT('note_url', note_url)) 
               FROM course_notes WHERE course_id = c.id) AS notes
            FROM courses c
            JOIN users u ON c.instructor_id = u.id
        `);

        res.render('studentCategories', {
            courses: courses.map(course => ({
                ...course,
                videos: Array.isArray(course.videos) ? course.videos : JSON.parse(course.videos || '[]'),
                notes: Array.isArray(course.notes) ? course.notes : JSON.parse(course.notes || '[]')
            })),
            user: req.user // Pass user data if needed
        });
    } catch (error) {
        console.error("Error fetching categories content:", error);
        res.status(500).send("Server error.");
    }
});

// Example route handler
// In studentRoutes.js
router.get('/student/courses', (req, res) => {
    const query = 'SELECT * FROM courses';
    
    db.query(query, (err, courses) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }
        // Render studentCategories.ejs and pass the fetched courses to the template
        res.render('studentCategories', { courses });
    });
});

// Route for serving video with a close button and redirect functionality
router.get('/watch/:videoFilename', (req, res) => {
    const videoFilename = req.params.videoFilename;
    
    // Render watchVideo.ejs and pass the video filename
    res.render('watchVideo', { videoFilename });
});
  
router.get('/course/:courseId/video/:videoId',
    verifyToken,
    progressTracking.trackProgress,
    async (req, res) => {
        try {
            // Get video URL from database
            const [video] = await db.query(`
                SELECT video_url 
                FROM course_videos 
                WHERE id = ? AND course_id = ?
            `, [req.params.video_id, req.params.course_id]);

            if (!video[0]) {
                return res.status(404).send('Video not found');
            }

            // Stream video (basic implementation)
            res.sendFile(video[0].video_url, { root: './uploads' });

        } catch (error) {
            console.error('Video streaming error:', error);
            res.status(500).send('Server error');
        }
    }
);

// Note viewing route
router.get('/course/:courseId/note/:noteId',
    verifyToken,
    progressTracking.trackProgress,
    async (req, res) => {
        try {
            // Get note URL from database
            const [note] = await db.query(`
                SELECT note_url 
                FROM course_notes 
                WHERE id = ? AND course_id = ?
            `, [req.params.note_id, req.params.course_id]);

            if (!note[0]) {
                return res.status(404).send('Note not found');
            }

            // Send note for download
            res.download(`./uploads/${note[0].note_url}`);

        } catch (error) {
            console.error('Note download error:', error);
            res.status(500).send('Server error');
        }
    }
);
router.get('/student/course/:courseId/video/:videoId', verifyToken, async (req, res) => {
    try {
        // Get video details from database
        const [video] = await db.query(`
            SELECT * FROM course_videos 
            WHERE id = ? AND course_id = ?
        `, [req.params.videoId, req.params.courseId]);

        if (!video[0]) {
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
// studentRoutes.js
// Video route with verification  
router.get('/student/video/:filename', verifyToken, (req, res) => {  
    try {  
        const filename = req.params.filename;  
        const videoPath = path.join(__dirname, '../uploads', filename);  
        
        // Check if the video file exists  
        fs.access(videoPath, fs.constants.F_OK, (err) => {  
            if (err) {  
                console.error('Video file not found:', filename);  
                return res.status(404).send('Video not found');  
            }  
            
            res.render('videoPlayer', {  
                videoUrl: `/uploads/${filename}`, // Ensure this points to the correct video path  
                filename: filename  
            });  
        });  
    } catch (error) {  
        console.error('Video route error:', error);  
        res.status(500).send('Server Error');  
    }  
});  
// Student: Enroll in a course
router.post('/enroll', enrollInCourse);  // Maps POST requests to enrollInCourse controller
// Route to render the video playback page
// Handle video playback route
router.get('/watch/:videoFilename', (req, res) => {
    const videoFilename = req.params.videoFilename;

    // Render the watch.ejs file, passing the video filename
    res.render('watchVideo', { videoFilename });

});


// Student: Track course progress
router.put('/track-progress', trackProgress);  // Maps PUT requests to trackProgress controller

module.exports = router;