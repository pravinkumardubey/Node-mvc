const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const register = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Username already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = req.body.role || "user";

    const newUser = await User.create({
      username,
      password: hashedPassword,
      role,
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: { id: newUser.id, username: newUser.username, role: newUser.role },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    let user = await User.findOne({ where: { username } });
    let payload;
    let role;

    if (user) {
      const passwordMatches = await bcrypt.compare(password, user.password);
      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });
      }

      payload = { id: user.id, username: user.username, role: user.role };
      role = user.role;
    } else {
      const validUsername = process.env.AUTH_USER || "admin";
      const validPassword = process.env.AUTH_PASS || "password";
      const userRole = process.env.AUTH_ROLE || "admin";

      if (username !== validUsername || password !== validPassword) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });
      }

      payload = { username: validUsername, role: userRole };
      role = userRole;
    }

    const secret = process.env.JWT_SECRET || "default_jwt_secret";
    const expiresIn = process.env.JWT_EXPIRES_IN || "1h";
    const token = jwt.sign(payload, secret, { expiresIn });

    res.status(200).json({
      success: true,
      token,
      expiresIn,
      role,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const me = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  try {
    if (req.user.id) {
      const user = await User.findByPk(req.user.id);
      if (user) {
        return res.status(200).json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            profilePicture: user.profilePicture,
          },
        });
      }
    }

    res.status(200).json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        profilePicture: null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    const userId = req.user.id;
    let imageUrl = "";

    if (process.env.STORAGE_TYPE === "s3") {
      imageUrl = req.file.location; // S3 returns the URL in req.file.location
    } else {
      // Local storage returns filename
      // Construct URL based on host
      const host = req.get('host');
      const protocol = req.protocol;
      imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.profilePicture = imageUrl;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile picture updated successfully",
      profilePicture: imageUrl,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  login,
  register,
  me,
  uploadProfilePicture,
};
