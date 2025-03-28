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

module.exports = router;
