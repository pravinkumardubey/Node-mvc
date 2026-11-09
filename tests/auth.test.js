const jwt = require("jsonwebtoken");
const authenticate = require("../middleware/auth");
const authorize = require("../middleware/authorize");

jest.mock("../models/User", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

const User = require("../models/User");
const { login, register } = require("../controllers/auth.controller");
const { me } = require("../controllers/auth.controller");

describe("Auth controller login", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.AUTH_USER = "admin";
    process.env.AUTH_PASS = "password";
    process.env.AUTH_ROLE = "admin";
    process.env.JWT_SECRET = "test_secret";
    process.env.JWT_EXPIRES_IN = "1h";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 401 for invalid credentials", async () => {
    const req = { body: { username: "wrong", password: "wrong" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    User.findOne.mockResolvedValue(null);
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid username or password",
    });
  });

  it("returns a token for valid credentials", async () => {
    const req = { body: { username: "admin", password: "password" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    User.findOne.mockResolvedValue(null);
    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(typeof response.token).toBe("string");
    expect(response.expiresIn).toBe("1h");

    const decoded = jwt.verify(response.token, "test_secret");
    expect(decoded.username).toBe("admin");
    expect(decoded.role).toBe("admin");
  });

  it("returns a token for a registered database user", async () => {
    const req = { body: { username: "dbuser", password: "password" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    User.findOne.mockResolvedValue({
      id: 1,
      username: "dbuser",
      password: await require("bcryptjs").hash("password", 10),
      role: "user",
    });

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(typeof response.token).toBe("string");
    expect(response.expiresIn).toBe("1h");
    const decoded = jwt.verify(response.token, "test_secret");
    expect(decoded.username).toBe("dbuser");
    expect(decoded.role).toBe("user");
  });
});

describe("Auth controller register", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = "test_secret";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 400 when username or password is missing", async () => {
    const req = { body: { username: "" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Username and password are required",
    });
  });

  it("returns 409 when the username already exists", async () => {
    const req = { body: { username: "existing", password: "password" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    User.findOne.mockResolvedValue({ id: 1, username: "existing" });

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Username already exists",
    });
  });

  it("registers a new user successfully", async () => {
    const req = { body: { username: "newuser", password: "password" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ id: 2, username: "newuser", role: "user" });

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "User registered successfully",
      user: { id: 2, username: "newuser", role: "user" },
    });
  });
});

describe("Auth controller me", () => {
  it("returns the authenticated user", () => {
    const req = { user: { id: 1, username: "dbuser", role: "user" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    me(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      user: { id: 1, username: "dbuser", role: "user" },
    });
  });

  it("returns 401 if not authenticated", () => {
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    me(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Unauthorized",
    });
  });
});

describe("authenticate middleware", () => {
  const secret = "test_secret";

  it("returns 401 when Authorization header is missing", () => {
    const req = { headers: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Authorization token missing or malformed",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid", () => {
    const req = { headers: { authorization: "Bearer invalid-token" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid or expired token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches decoded token payload and calls next for a valid token", () => {
    const token = jwt.sign({ username: "admin", role: "admin" }, secret);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    const next = jest.fn();

    process.env.JWT_SECRET = secret;
    authenticate(req, res, next);

    expect(req.user).toEqual(expect.objectContaining({ username: "admin", role: "admin" }));
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("authorize middleware", () => {
  it("returns 403 if user role is missing", () => {
    const req = { user: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    authorize(["admin"])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Missing user role for authorization",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 if role is not allowed", () => {
    const req = { user: { role: "user" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    authorize(["admin"])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Insufficient permissions",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when role is allowed", () => {
    const req = { user: { role: "admin" } };
    const res = {};
    const next = jest.fn();

    authorize(["admin"])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
