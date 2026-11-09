const express = require("express");
const router = express.Router();
const { login, register, uploadProfilePicture, me } = require("../controllers/auth.controller");
const authenticate = require("../middleware/auth");
const upload = require("../middleware/upload");

router.post("/login", login);
router.post("/register", register);
router.get("/me", authenticate, me);
router.post("/me/picture", authenticate, upload.single("image"), uploadProfilePicture);

module.exports = router;
