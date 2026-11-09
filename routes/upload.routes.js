const express = require("express");
const router = express.Router();

const { chatUpload } = require("../middleware/upload");
const { uploadChatAttachment } = require("../controllers/upload.controller");
const authenticate = require("../middleware/auth");

// POST /uploads/chat — upload a chat attachment (requires auth)
router.post("/chat", authenticate, chatUpload.single("file"), uploadChatAttachment);

module.exports = router;
