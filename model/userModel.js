const db = require('../config/db');

// Get all users from the database
const getAllUsers = async () => {
    try {
        const [users] = await db.query("SELECT * FROM users");
        return users;
    } catch (err) {
        console.error("Error fetching users from DB:", err);
        throw err;
    }
};

// Get a user by their ID
const getUserById = async (id) => {
    try {
        const [user] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
        return user[0];
    } catch (err) {
        console.error("Error fetching user by ID:", err);
        throw err;
    }
};
// Fetch user by email
const getUserByEmail = async (email) => {
    try {
        const [user] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        console.log("User fetched from DB in userModel:", user);
        return user[0];  // Return the first user object
    } catch (err) {
        console.error("Error fetching user by email in userModel:", err);
        throw err;
    }
};


// Update user information (including optional photo)
const updateUser = async (id, name, email, photo) => {
    try {
        if (photo) {
            await db.query("UPDATE users SET name = ?, email = ?, photo = ? WHERE id = ?", [name, email, photo, id]);
        } else {
            await db.query("UPDATE users SET name = ?, email = ? WHERE id = ?", [name, email, id]);
        }
    } catch (err) {
        console.error("Error updating user information:", err);
        throw err;
    }
};

// Register a new user
const registerUser = async (name, email, password) => {
    try {
        await db.query("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [name, email, password]);
    } catch (err) {
        console.error("Error registering new user:", err);
        throw err;
    }
};

// Enroll a user in a course
const enrollUserInCourse = async (userId, courseId) => {
    try {
        await db.query("INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)", [userId, courseId]);
    } catch (err) {
        console.error("Error enrolling user in course:", err);
        throw err;
    }
};

// Get enrolled courses for a user
// In getUserCourses
const getUserCourses = async (userId) => {
    try {
        const [courses] = await db.query(`
            SELECT c.id, c.title, c.description 
            FROM courses c 
            INNER JOIN enrollments e ON c.id = e.course_id 
            WHERE e.user_id = ?
        `, [userId]);
        return courses;
    } catch (err) {
        console.error("Error fetching user courses:", err);
        throw err;
    }
};

// Track course progress for a user
const updateProgress = async (userId, courseId, progressPercentage) => {
    try {
        await db.query(`
            INSERT INTO course_progress (user_id, course_id, progress) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE progress = ?
        `, [userId, courseId, progressPercentage, progressPercentage]);
    } catch (err) {
        console.error("Error updating course progress:", err);
        throw err;
    }
};

// Fetch progress of a course for a user
const getProgress = async (userId, courseId) => {
    try {
        const [result] = await db.query("SELECT progress FROM course_progress WHERE user_id = ? AND course_id = ?", [userId, courseId]);
        return result.length ? result[0].progress : 0;  
    } catch (err) {
        console.error("Error fetching course progress:", err);
        throw err;
    }
};
const findOne = async (email) => {
    try {
        const [user] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        return user[0]; // Return the first user that matches
    } catch (err) {
        console.error("Error fetching user by email:", err);
        throw err;
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    registerUser,
    enrollUserInCourse,
    getUserCourses,
    updateProgress,
    getProgress,
    findOne,
    getUserByEmail  
};
