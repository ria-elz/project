const db = require('../config/db');
const path = require('path');
const fs = require('fs');

// Fetch all courses
const getAllCourses = async () => {
    try {
        const [courses] = await db.query("SELECT * FROM courses");
        return courses;
    } catch (err) {
        console.error("Error fetching courses from DB:", err);
        throw err;
    }
};

// Fetch a single course by ID
const getCourseById = async (courseId) => {
    try {
        const [rows] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);
        return rows[0];
    } catch (err) {
        console.error(`Error fetching course with ID ${courseId}:`, err);
        throw err;
    }
};

// Enroll a user in a course (with optional course existence check)
const enrollInCourse = async (userId, courseId) => {
    const [course] = await db.query('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course.length) throw new Error(`Course with ID ${courseId} not found.`);
    await db.query('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)', [userId, courseId]);
};

// Get user progress across enrolled courses
const getUserProgress = async (userId) => {
    try {
        const [rows] = await db.query(
            `SELECT c.title, cp.progress 
            FROM course_progress cp 
            INNER JOIN courses c ON cp.course_id = c.id 
            WHERE cp.user_id = ?`,
            [userId]
        );
        return rows;
    } catch (err) {
        console.error("Error fetching user progress:", err);
        throw err;
    }
};


// Create a course with videos and notes (as JSON arrays)
const createCourse = async (courseData) => {
    const { instructorId, courseTitle, description, isPremium } = courseData;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        // Insert base course
        const [result] = await connection.query(
            `INSERT INTO courses (instructor_id, title, description, is_premium) VALUES (?, ?, ?, ?)`,
            [instructorId, courseTitle, description, isPremium]
        );
        
        const courseId = result.insertId;

        // Process files through separate tables
        const processFiles = async (files, tableName) => {
            if (files && files.length > 0) {
                const columnName = tableName === 'course_videos' ? 'video_url' : 'note_url';
        
                await Promise.all(files.map(async (file) => {
                    await connection.query(
                        `INSERT INTO ${tableName} (course_id, ${columnName}) VALUES (?, ?)`,
                        [courseId, file]
                    );
                }));
            }
        };
        

        await processFiles(courseData.videos, 'course_videos');
        await processFiles(courseData.notes, 'course_notes');

        await connection.commit();
        return courseId;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};
const deleteCourse = async (courseId) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Delete related records
        await connection.query('DELETE FROM course_videos WHERE course_id = ?', [courseId]);
        await connection.query('DELETE FROM course_notes WHERE course_id = ?', [courseId]);
        
        // Delete base course
        await connection.query('DELETE FROM courses WHERE id = ?', [courseId]);

        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};

const updateCourse = async (courseId, courseData) => {
    const { title, description, isPremium } = courseData;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Update base course
        await connection.query(
            `UPDATE courses SET title = ?, description = ?, is_premium = ? WHERE id = ?`,
            [title, description, isPremium, courseId]
        );

        // Additional logic to handle file updates can be added here

        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};

module.exports = {
    getAllCourses,
    getCourseById,
    enrollInCourse,
    getUserProgress,
    createCourse,
    deleteCourse,
    updateCourse
};