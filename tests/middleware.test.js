const logger = require("../middleware/logger");
const validate = require("../middleware/validate");

jest.mock("express-validator", () => ({
  validationResult: jest.fn(),
}));

const { validationResult } = require("express-validator");

describe("logger middleware", () => {
  it("logs the request method and URL, then calls next", () => {
    const req = { method: "POST", url: "/products" };
    const res = {};
    const next = jest.fn();

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    logger(req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith("POST /products");
    expect(next).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });
});

describe("validate middleware", () => {
  beforeEach(() => {
    validationResult.mockReset();
  });

  it("returns 400 when validation errors are present", () => {
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: "Product name is required" }],
    });

    validate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      errors: [{ msg: "Product name is required" }],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when there are no validation errors", () => {
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    validationResult.mockReturnValue({
      isEmpty: () => true,
    });

    validate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
