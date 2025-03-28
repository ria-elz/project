const db = require('../config/db');

const getAllCourses = async () => {
    const [rows] = await db.query('SELECT * FROM courses');
    return rows;
};

const getCourseById = async (courseId) => {
    const [rows] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);
    return rows[0];
};

const enrollInCourse = async (userId, courseId) => {
    await db.query('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)', [userId, courseId]);
};

const getUserProgress = async (userId) => {
    const [rows] = await db.query(`
        SELECT c.title, cp.progress 
        FROM course_progress cp 
        INNER JOIN courses c ON cp.course_id = c.id 
        WHERE cp.user_id = ?
    `, [userId]);
    return rows;
};

module.exports = {
    getAllCourses,
    getCourseById,
    enrollInCourse,
    getUserProgress
};
