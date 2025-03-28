const db = require('../config/db'); 
module.exports = {
    trackProgress: async (req, res, next) => {
        try {
            const user_id = req.user.id;
            const course_id = req.params.courseId;
            const content_id = req.params.videoId || req.params.noteId;
            const content_type = req.path.includes('video') ? 'video' : 'note';

            await db.query(
                `INSERT INTO course_progress 
                (user_id, course_id, content_id, content_type, progress)
                VALUES (?, ?, ?, ?, 100)
                ON DUPLICATE KEY UPDATE
                    progress = 100,
                    last_viewed = CURRENT_TIMESTAMP`,
                [user_id, course_id, content_id, content_type]
            );
            next();
        } catch (error) {
            console.error('Progress tracking error:', error);
            next();
        }
    }
};