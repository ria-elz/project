// studentRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');
const progressTracking = require('../middleware/progressTracking');
const {
    getUploadedContent,
    enrollInCourse,     // Make sure this is properly defined in userController.js
    trackProgress,      // Also ensure this function exists and is exported from userController.js
} = require('../controller/userController');

router.get('/categories', async (req, res) => {
    try {
        const content = await getUploadedContent();  // Fetch uploaded videos/notes
        res.render('studentCategories', { content });  // Render studentCategories.ejs and pass content
    } catch (error) {
        console.error("Error fetching categories content:", error);
        res.status(500).send("Server error.");
    }
});
// Example route handler
// In studentRoutes.js
router.get('/student/courses', verifyToken, async (req, res) => {
    try {
      // Fetch courses with their videos/notes from the database
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
  
      // Parse JSON fields and pass to the template
      res.render('studentCategories', {
        courses: courses.map(course => ({
          ...course,
          videos: JSON.parse(course.videos || '[]'),
          notes: JSON.parse(course.notes || '[]')
        })),
        user: req.user // Pass user data if needed
      });
  
    } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
    }
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
// Student: Enroll in a course
router.post('/enroll', enrollInCourse);  // Maps POST requests to enrollInCourse controller

// Student: Track course progress
router.put('/track-progress', trackProgress);  // Maps PUT requests to trackProgress controller

module.exports = router;
