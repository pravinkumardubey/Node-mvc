const Product = require("../models/Product");

// Get All Products
const getProducts = async (req, res) => {
    try {
        const { Op } = require("sequelize");

        // 1) Search
        const search = req.query.search || "";
        const where = {};

        if (search) {
            where.name = {
                [Op.like]: `%${search}%`
            };
        }

        // 2) Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        // 3) Sorting
        const sortBy = req.query.sortBy || "createdAt";
        const sortOrder = req.query.sortOrder ? req.query.sortOrder.toUpperCase() : "DESC";

        const { count, rows: products } = await Product.findAndCountAll({
            where,
            limit,
            offset,
            order: [[sortBy, sortOrder]]
        });

        res.status(200).json({
            success: true,
            count,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            data: products,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Get Single Product
const getProduct = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        res.status(200).json({
            success: true,
            data: product,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Create Product
const createProduct = async (req, res) => {
    try {

        const product = await Product.create(req.body);

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: product,
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message,
        });

    }
};

// Update Product
const updateProduct = async (req, res) => {

    try {

        const product = await Product.findByPk(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        await product.update(req.body);

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: product,
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message,
        });

    }

};

// Delete Product
const deleteProduct = async (req, res) => {

    try {

        const product = await Product.findByPk(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        await product.destroy();

        res.status(200).json({
            success: true,
            message: "Product deleted successfully",
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message,
        });

    }

};

module.exports = {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
};