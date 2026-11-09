const express = require("express");
const router = express.Router();
const { listUsers, getUser, createUser, updateUser, deleteUser, getUserByUsername, searchUsers } = require("../controllers/user.controller");
const authenticate = require("../middleware/auth");

// Public routes
router.get("/username/:username", getUserByUsername);

// All other routes require authentication
router.use(authenticate);

// Admin-only middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
};

router.get("/", listUsers);
router.get("/search", searchUsers);
router.get("/:id", getUser);
router.post("/", adminOnly, createUser);
router.put("/:id", adminOnly, updateUser);
router.delete("/:id", adminOnly, deleteUser);

module.exports = router;
