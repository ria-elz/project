// userController.js
const bcrypt = require('bcrypt');
const db = require('../config/db');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const { createCourse } = require('../model/courseModel');


// Admin - Add User with Role


const addUserByAdmin = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Check if the email already exists
        const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            req.flash('error', 'Email already exists');
            return res.redirect('/admin/dashboard');
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert the new user into the database
        await db.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, role]
        );

        req.flash('success', 'User added successfully');
        return res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Error adding user by admin:', error);
        req.flash('error', 'Failed to add user');
        return res.redirect('/admin/dashboard');
    }
};

// Admin - Delete User (with req and res)
// Controller function for deleting user
const deleteUserByAdmin = async (req, res) => {
    try {
        const userId = req.params.userId;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        // First, delete all enrollments for the user
        await db.query('DELETE FROM enrollments WHERE user_id = ?', [userId]);

        // Then, delete the user
        const [result] = await db.query('DELETE FROM users WHERE id = ?', [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.status(200).json({ message: 'User deleted successfully', deletedUserId: userId });

    } catch (error) {
        console.error('Error deleting user:', error);

        if (!res.headersSent) {
            return res.status(500).json({ error: 'Server error while deleting user', details: error.message });
        }
    }
};


// Admin - Approve Course
const approveCourse = async (req, res) => {
    try {
        const { courseId } = req.body;
        await db.query('UPDATE courses SET approved = 1 WHERE id = ?', [courseId]);
        res.status(200).json({ message: "Course approved by admin!" });
    } catch (error) {
        console.error("Admin - Approve Course Error:", error);
        res.status(500).json({ error: "Error approving course" });
    }
};

const getAllUsers = async () => {
    try {
        const [users] = await db.query("SELECT * FROM users");
        return users;
    } catch (err) {
        console.error("Error fetching users from DB:", err);
        throw err;
    }
};
const deleteCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        await db.query('DELETE FROM courses WHERE id = ?', [courseId]);
        res.status(200).json({ message: "Course deleted by admin!" });
    } catch (error) {
        console.error("Admin - Delete Course Error:", error);
        res.status(500).json({ error: "Error deleting course by admin" });
    }
};
const createCourseHandler = async (req, res) => {
    try {
        const { courseTitle, description } = req.body;
        const videos = req.files['videos'].map(file => file.filename);  // Get video filenames
        const notes = req.files['notes'].map(file => file.filename);    // Get note filenames

        // Create the course in the MySQL database
        const newCourseId = await createCourse({
            instructorId: req.user.id,  // Assuming req.user contains the instructor's ID
            courseTitle,
            description,
            videos,
            notes
        });

        res.send(`Course created successfully! Course ID: ${newCourseId}`);
    } catch (error) {
        console.error('Error creating course:', error);
        res.status(500).send('Server Error.');
    }
};

     

const editCourse = async (req, res) => {
    try {
        const { courseId, title, description, video_url } = req.body;
        await db.query('UPDATE courses SET title = ?, description = ?, video_url = ? WHERE id = ?', 
                      [title, description, video_url, courseId]);
        res.status(200).json({ message: "Course updated successfully!" });
    } catch (error) {
        console.error("Instructor - Edit Course Error:", error);
        res.status(500).json({ error: "Error updating course" });
    }
};
const deleteCourseByInstructor = async (req, res) => {
    try {
        const { courseId } = req.params;
        await db.query('DELETE FROM courses WHERE id = ?', [courseId]);
        res.status(200).json({ message: "Course deleted by instructor!" });
    } catch (error) {
        console.error("Instructor - Delete Course Error:", error);
        res.status(500).json({ error: "Error deleting course by instructor" });
    }
};



// Enroll a student in a course
const enrollInCourse = async (req, res) => {
    try {
        const userId = req.user.id;
        const { courseId } = req.body;
        console.log("Enroll request received. userId:", userId, "courseId:", courseId);
        
        if (!courseId) {
            console.error("Enrollment error: Missing courseId");
            return res.status(400).send("Course ID is required.");
        }
        
        // Check if already enrolled
        const [existing] = await db.query(
            "SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?",
            [userId, courseId]
        );
        if (existing && existing.length > 0) {
            console.warn("User already enrolled in course", courseId);
            return res.redirect('/student/categories'); // already enrolled
        }
        
        // Insert new enrollment record
        const [result] = await db.query(
            "INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)",
            [userId, courseId]
        );
        console.log("Enrollment inserted, result:", result);
        res.redirect('/student/categories');
    } catch (error) {
        console.error("Enrollment error:", error);
        res.status(500).send("Enrollment failed: " + error.message);
    }
};

// Track student's progress in a course
const trackProgress = async (req, res) => {
    try {
        const userId = req.user.id; // Use authenticated user ID
        const { courseId, contentId, contentType, progress } = req.body;
        
        await db.query(
            `INSERT INTO course_progress 
            (user_id, course_id, content_id, content_type, progress)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE progress = ?`,
            [userId, courseId, contentId, contentType, progress, progress]
        );
        res.status(200).json({ message: "Progress updated!" });
    } catch (error) {
        console.error("Progress tracking error:", error);
        res.status(500).json({ error: "Progress update failed" });
    }
};
// Add a new course (Admin)
const addCourseByAdmin = async (req, res) => {
    try {
        const { title, description, instructorId } = req.body;

        // Insert new course into DB
        await db.query('INSERT INTO courses (title, description, instructor_id) VALUES (?, ?, ?)',
            [title, description, instructorId]);

        res.redirect('/admin/dashboard?message=Course+added+successfully');
    } catch (error) {
        console.error("Error adding course by admin:", error);
        res.status(500).send("Server error while adding course.");
    }
};

// Delete a course (Admin)
const deleteCourseByAdmin = async (req, res) => {
    try {
        const { courseId } = req.params;
        await db.query('DELETE FROM courses WHERE id = ?', [courseId]);
        res.redirect('/admin/dashboard?message=Course+deleted+successfully');
    } catch (error) {
        console.error("Error deleting course by admin:", error);
        res.status(500).send("Server error while deleting course.");
    }
};
// Get all courses from the database
const getAllCourses = async () => {
    try {
        const [courses] = await db.query("SELECT * FROM courses");
        return courses;  // Return list of courses
    } catch (err) {
        console.error("Error fetching courses from DB:", err);
        throw err;
    }
};
const getUploadedContent = async () => {
    try {
        const [rows] = await db.query('SELECT * FROM content');  // Replace with your actual table name
        return rows;  // Return the uploaded content (e.g., videos/notes)
    } catch (error) {
        console.error("Error fetching uploaded content:", error);
        throw error;
    }
};
const getInstructorCourses = async (req, res) => {
    try {
        const courses = await getAllCourses();
        const instructorCourses = courses.filter(course => course.instructor_id === req.user.id);
        
        // Parse the JSON strings into arrays
        const parsedCourses = instructorCourses.map(course => ({
            ...course,
            videos: JSON.parse(course.videos || '[]'),  // Parse videos array
            notes: JSON.parse(course.notes || '[]')     // Parse notes array
        }));
        
        res.render('instructorDashboard', { 
            courses: parsedCourses,
            user: req.user
        });
    } catch (err) {
        console.error('Error fetching courses:', err);
        res.status(500).render('error', { message: 'Internal Server Error' });
    }
};

const viewEnrolledStudents = async (req, res) => {
    try {
        const { courseId } = req.params;
        const [students] = await db.query(`
            SELECT u.name, u.email 
            FROM users u
            INNER JOIN enrollments e ON u.id = e.user_id
            WHERE e.course_id = ?
        `, [courseId]);

        res.status(200).json({ enrolledStudents: students });
    } catch (error) {
        console.error("Error viewing enrolled students:", error);
        res.status(500).json({ error: "Error fetching enrolled students" });
    }
};
const getAdminDashboard = async (req, res) => {
    try {
        const users = await User.find();  // Fetch all users
        const courses = await Course.find();  // Fetch all courses

        res.render('adminDashboard', { users, courses });  // Pass users and courses to EJS
    } catch (error) {
        console.error('Error fetching admin data:', error);
        res.status(500).send('Server error');
    }
};

console.log(module.exports);

module.exports = {
    addUserByAdmin,
    deleteUserByAdmin,  // Updated export
    approveCourse,
    getAllUsers,
    deleteCourse,
    createCourse,
    editCourse,
    deleteCourseByInstructor,
    viewEnrolledStudents,
    enrollInCourse,      // Newly added function
    trackProgress,
    addCourseByAdmin,
    deleteCourseByAdmin,
    getAllCourses,
    getUploadedContent,
    getInstructorCourses,
    createCourseHandler,
    getAdminDashboard

};
