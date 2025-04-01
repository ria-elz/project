const db = require('../config/db');

const checkPremiumAccess = async (req, res, next) => {
    const userId = req.user.id;
    const videoId = req.params.videoId;

    try {
        // Check if the video is premium
        const [video] = await db.query(
            'SELECT is_premium FROM course_videos WHERE id = ?',
            [videoId]
        );

        if (!video.length) {
            return res.status(404).send('Video not found');
        }

        if (video[0].is_premium) {
            // Check if the user has purchased the premium content
            const [purchase] = await db.query(
                'SELECT * FROM premium_purchases WHERE user_id = ? AND video_id = ?',
                [userId, videoId]
            );

            if (!purchase.length) {
                return res.status(403).send('You need to purchase this video to access it');
            }
        }

        next();
    } catch (error) {
        console.error('Premium access check error:', error);
        res.status(500).send('Server error');
    }
};

module.exports = checkPremiumAccess;