const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { Op } = require("sequelize");

// GET /users — List all users
const listUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "username", "role", "profilePicture", "createdAt"],
    });
    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /users/:id — Get a single user
const getUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ["id", "username", "role", "profilePicture", "createdAt"],
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /users — Create a new user (admin only)
const createUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(409).json({ success: false, message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      password: hashedPassword,
      role: role || "user",
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: { id: newUser.id, username: newUser.username, role: newUser.role },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /users/:id — Update a user (admin only)
const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { username, password, role } = req.body;

    if (username) user.username = username;
    if (role) user.role = role;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /users/:id — Delete a user (admin only)
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await user.destroy();
    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /users/username/:username — Get a user by username
const getUserByUsername = async (req, res) => {
  try {
    const user = await User.findOne({
      where: { username: req.params.username },
      attributes: ["id", "username", "role", "profilePicture", "createdAt"],
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /users/search?q=query
const searchUsers = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ success: false, message: "Query parameter 'q' is required" });
    }

    const users = await User.findAll({
      where: {
        username: {
          [Op.like]: `%${query}%`
        }
      },
      attributes: ["id", "username", "role", "profilePicture", "createdAt"],
      limit: 20
    });

    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser, getUserByUsername, searchUsers };
