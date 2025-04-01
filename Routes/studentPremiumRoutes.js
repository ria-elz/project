const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');
const checkPremiumAccess = require('../middleware/premiumCheck');

// 🔹 Stream Course Videos with Premium Check
router.get('/course/:courseId/video/:videoId', verifyToken, checkPremiumAccess, async (req, res) => {
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

module.exports = router;