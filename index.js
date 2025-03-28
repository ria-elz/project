// index.js (Updated)
const express = require('express');
const db = require('./config/db');  
const lRoute = require('./Routes/loginRoutes');

const path = require('path');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const multer = require('multer');  
const { getAllCourses, getCourseById, enrollInCourse, getUserProgress } = require('./model/courseModel');
const app = express();

const JWT_SECRET = 'your-secret-key';

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'views'));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

const verifyToken = (req, res, next) => {
    const token = req.cookies.token || req.session.token;
    if (!token) {
        return res.redirect('/login');
    }
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.redirect('/login');
        }
        req.user = decoded;
        next();
    });
};

// Routes
app.get('/home', verifyToken, async (req, res) => {
    try {
        const courses = await getAllCourses(); // Fetch available courses
        res.render('home', {
            courses,
            user: req.session.user || { name: 'Guest' }
        });
    } catch (err) {
        console.error("Error loading home page:", err);
        res.status(500).send("Server Error");
    }
});

app.get('/courses/:id', verifyToken, async (req, res) => {
    try {
        const course = await getCourseById(req.params.id);
        const progress = await trackProgress(req.user.id, req.params.id);
        res.render('courseDetails', { course, progress });
    } catch (err) {
        console.error("Error loading course details:", err);
        res.status(500).send("Server Error");
    }
});

app.post('/enroll/:id', verifyToken, async (req, res) => {
    try {
        await enrollCourse(req.user.id, req.params.id);
        res.redirect(`/courses/${req.params.id}`);
    } catch (err) {
        console.error("Error enrolling in course:", err);
        res.status(500).send("Server Error");
    }
});

app.get('/upload', verifyToken, (req, res) => {
    if (req.session.user && req.session.user.role === 'instructor') {
        res.render('uploadLecture');
    } else {
        res.status(403).send('Access Denied');
    }
});

app.post('/upload', verifyToken, upload.single('video'), async (req, res) => {
    try {
        const { courseId, title } = req.body;
        const videoPath = req.file.filename;
        await addLecture(courseId, title, videoPath);
        res.redirect('/home');
    } catch (err) {
        console.error("Error uploading video:", err);
        res.status(500).send("Server Error");
    }
});

app.get('/', (req, res) => {
    res.render('index', { user: req.session.user || null });
});

app.get('/register', (req, res) => {
    res.render('register', {
        errors: [],
        name: '',
        email: ''
    });
});

app.get('/login', (req, res) => {
    res.render('login', { errors: [] });  // Pass an empty errors array by default
});


app.get('/logout', (req, res) => {
    res.clearCookie('token');
    req.session.destroy();
    res.redirect('/login');
});

app.use("/", lRoute);

app.get('/courses', verifyToken, async (req, res) => {
    const courses = await getAllCourses();
    res.render('courses', { courses });
});

// View course details
app.get('/course/:id', verifyToken, async (req, res) => {
    const course = await getCourseById(req.params.id);
    res.render('courseDetails', { course });
});

// Enroll in a course
app.get('/enroll/:id', verifyToken, async (req, res) => {
    await enrollInCourse(req.user.id, req.params.id);
    res.redirect('/progress');
});

// View course progress
app.get('/progress', verifyToken, async (req, res) => {
    const progressList = await getUserProgress(req.user.id);
    res.render('progress', { progressList });
});

app.listen(3002, () => {
    console.log("Server is running on port 3002");
});
