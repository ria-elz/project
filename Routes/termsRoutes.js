const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('terms'); // Ensure 'terms.ejs' exists in 'views'
});

module.exports = router;
