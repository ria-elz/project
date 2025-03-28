const mysql = require('mysql2/promise');

// Create a connection to the database
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',  // Replace with your actual DB password
    database: 'online_learning_platform'
});

// Initialize tables (if they don't exist)
const initializeDatabase = async () => {
    try {
        // Users table (Admin, Instructor, Student roles will be referenced here)
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'instructor', 'student') NOT NULL,
                photo VARCHAR(255) DEFAULT NULL
            );
        `);

        // Courses table (Instructors will add courses)
        await db.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                instructor_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                video_url VARCHAR(255) NOT NULL,
                FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);

        // Enrollments table (Students enrolling in courses)
        await db.query(`
            CREATE TABLE IF NOT EXISTS enrollments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                course_id INT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (course_id) REFERENCES courses(id)
            );
        `);

        // Course Progress table (Tracking progress of students)
        await db.query(`
            CREATE TABLE IF NOT EXISTS course_progress (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                course_id INT NOT NULL,
                progress INT DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (course_id) REFERENCES courses(id)
            );
        `);

        console.log("Database tables with roles initialized successfully!");
    } catch (err) {
        console.error("Error initializing database tables:", err);
        throw err;
    }
};

// Run the table initialization function
initializeDatabase();

module.exports = db;
