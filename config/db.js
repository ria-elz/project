const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'online_learning_platform',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create connection pool
const db = mysql.createPool(dbConfig);

// db.js
const verifyConnection = async () => {
    try {
        const conn = await db.getConnection();
        await conn.ping();
        conn.release();
        console.log('✅ Database connection verified');
    } catch (err) {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
    }
};

// Initialize tables with proper error handling
const initializeDatabase = async () => {
    let connection;
    try {
        connection = await db.getConnection();
        
        // 1. Create users table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'instructor', 'student') NOT NULL,
                photo VARCHAR(255) DEFAULT NULL
            ) ENGINE=InnoDB;
        `);

        // 2. Create courses table (without video_url)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                instructor_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        // 3. Create course_videos table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS course_videos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                course_id INT NOT NULL,
                video_url VARCHAR(255) NOT NULL,
                title VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        // 4. Create course_notes table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS course_notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                course_id INT NOT NULL,
                note_url VARCHAR(255) NOT NULL,
                title VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        // 5. Create enrollments table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS enrollments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                course_id INT NOT NULL,
                enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (course_id) REFERENCES courses(id)
            ) ENGINE=InnoDB;
        `);

        // 6. Create course_progress table (fixed version)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS course_progress (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                course_id INT NOT NULL,
                content_id INT NOT NULL,
                content_type ENUM('video', 'note') NOT NULL,
                progress FLOAT DEFAULT 0,
                last_viewed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (course_id) REFERENCES courses(id),
                INDEX content_idx (content_type, content_id)
            ) ENGINE=InnoDB;
        `);

        console.log("Database tables initialized successfully!");
    } catch (err) {
        console.error("Database initialization error:", err);
        throw err;
    } finally {
        if (connection) connection.release();
    }
};

// Verify database connection
// (This function is already defined earlier, so this duplicate is removed)

// Initialize database with connection verification
(async () => {
    await verifyConnection();
    await initializeDatabase();
})();

module.exports = db;