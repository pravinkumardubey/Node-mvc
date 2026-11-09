const { body } = require("express-validator");

exports.createProductValidation = [

    body("name")
        .notEmpty()
        .withMessage("Product name is required"),

    body("price")
        .notEmpty()
        .withMessage("Price is required")
        .isNumeric()
        .withMessage("Price must be numeric"),

    body("stock")
        .optional()
        .isInt()
        .withMessage("Stock must be integer")

];