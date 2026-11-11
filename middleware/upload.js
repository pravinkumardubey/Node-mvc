const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const path = require("path");
const fs = require("fs");

// Ensure a local upload folder exists (multer doesn't create dirs when destination is a function)

const ensureLocalDir = (folder) => {
    const baseDir = path.join(__dirname, "../public/uploads");
    const dir = folder ? path.join(baseDir, folder) : baseDir;

    fs.mkdirSync(dir, { recursive: true });

    return dir;
};


// Image-only filter (existing profile picture behavior)
const imageFileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    }
    cb(new Error("Only images (jpeg, jpg, png, gif, webp) are allowed"));
};

// Wider filter for chat attachments: images + common docs/media
const chatFileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|txt|csv|doc|docx|xls|xlsx|ppt|pptx|mp4|mp3|wav|zip/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype || extname) {
        return cb(null, true);
    }
    cb(new Error("File type not allowed"));
};

// Build a multer storage backend (local disk or S3) for a given folder + prefix
const buildStorage = (folder, prefix) => {
    if (process.env.STORAGE_TYPE === "s3") {
        const s3 = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });

        return multerS3({
            s3,
            bucket: process.env.AWS_S3_BUCKET_NAME,
            metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
            key: (req, file, cb) => {
                const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
                const key = folder
                    ? `${folder}/${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`
                    : `${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`;
                cb(null, key);
            },
        });
    }

    const dir = ensureLocalDir(folder);

    return multer.diskStorage({
        destination: (req, file, cb) => cb(null, dir),
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
            cb(null, `${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
        },
    });
};

const makeUploader = ({ folder, prefix, fileFilter, maxSizeMb }) =>
    multer({
        storage: buildStorage(folder, prefix),
        fileFilter,
        limits: { fileSize: maxSizeMb * 1024 * 1024 },
    });

// Profile pictures: images only, 5MB — unchanged behavior
const upload = makeUploader({
    folder: "",
    prefix: "profile",
    fileFilter: imageFileFilter,
    maxSizeMb: 5,
});

// Chat attachments: images + docs/media, 15MB
const chatUpload = makeUploader({
    folder: "chat",
    prefix: "chat",
    fileFilter: chatFileFilter,
    maxSizeMb: 15,
});

module.exports = upload;
module.exports.upload = upload;
module.exports.chatUpload = chatUpload;
module.exports.default = upload;
