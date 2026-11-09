const express = require("express");
const router = express.Router();

const {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
} = require("../controllers/product.controller");

const {
    createProductValidation
} = require("../validators/product.validator");

const validate = require("../middleware/validate");
const authenticate = require("../middleware/auth");
const authorize = require("../middleware/authorize");

router.get("/", getProducts);
router.get("/:id", authenticate, getProduct);

router.post(
    "/",
    authenticate,
    authorize(["admin"]),
    createProductValidation,
    validate,
    createProduct
);

router.put(
    "/:id",
    authenticate,
    authorize(["admin"]),
    updateProduct
);

router.delete(
    "/:id",
    authenticate,
    authorize(["admin"]),
    deleteProduct
);

module.exports = router;