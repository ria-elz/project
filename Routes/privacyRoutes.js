// Routes/privacyRoutes.js
const express = require("express");
const router = express.Router();

// Route to serve Privacy Policy page
router.get("/privacy-policy", (req, res) => {
    res.render("privacyPolicy"); // Ensure "privacyPolicy.ejs" exists in views folder
});


module.exports = router;

