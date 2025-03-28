// courseRoutes.js
const express = require('express');
const router = express.Router();
const Course = require('../model/courseModel');
const User = require('../model/userModel');

// Fetch All Available Courses
router.get('/', async (req, res) => {
    try {
        const courses = await Course.find();
        res.render('courses', { courses });
    } catch (err) {
        console.error('Error fetching courses:', err);
        res.status(500).send('Server error.');
    }
});

// Enroll in a Course
router.post('/enroll/:courseId', async (req, res) => {
    const { courseId } = req.params;
    const userId = req.session.user._id;

    try {
        const user = await User.findByIdAndUpdate(userId, { $addToSet: { enrolledCourses: courseId } });
        if (!user) return res.status(404).send('User not found.');
        res.redirect('/home');
    } catch (err) {
        console.error('Error enrolling in course:', err);
        res.status(500).send('Server error.');
    }
});

// View Course Content (Video Player Page)
router.get('/:courseId', async (req, res) => {
    const { courseId } = req.params;

    try {
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).send('Course not found.');
        res.render('courseContent', { course });
    } catch (err) {
        console.error('Error fetching course content:', err);
        res.status(500).send('Server error.');
    }
});
// In your course routes file
// Student route to view a course
router.get('/course/:id', verifyToken, async (req, res) => {
    try {
      // Get course details
      const [course] = await db.query(
        'SELECT * FROM courses WHERE id = ?',
        [req.params.id]
      );
  
      // Get videos and notes for the course
      const [videos] = await db.query(
        'SELECT * FROM course_videos WHERE course_id = ?',
        [req.params.id]
      );
      const [notes] = await db.query(
        'SELECT * FROM course_notes WHERE course_id = ?',
        [req.params.id]
      );
  
      res.render('studentCourseView', {
        course: course[0],
        videos,
        notes,
        messages: req.flash()
      });
    } catch (error) {
      console.error('Course view error:', error);
      res.status(500).send('Server Error');
    }
  });

module.exports = router;
