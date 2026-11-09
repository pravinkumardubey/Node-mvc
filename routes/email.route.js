const express = require("express");
const router = express.Router();
const {
    sendEmail,
} = require("../controllers/email.controller");
// const email = require('../controllers/email.controller.js');
router.get("/",sendEmail);
module.exports = router;