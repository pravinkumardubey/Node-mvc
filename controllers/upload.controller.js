// Handles chat attachment uploads (called after multer middleware)
const uploadChatAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file provided",
      });
    }

    const isImage = /^image\//.test(req.file.mimetype || "");
    let fileUrl = "";
    let fileName = "";

    if (process.env.STORAGE_TYPE === "s3") {
      fileUrl = req.file.location; // S3 public URL
      fileName = req.file.key.split("/").pop();
    } else {
      const host = req.get("host");
      const protocol = req.protocol;
      fileUrl = `${protocol}://${host}/uploads/chat/${req.file.filename}`;
      fileName = req.file.originalname;
    }

    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      file: {
        url: fileUrl,
        name: fileName,
        type: req.file.mimetype,
        size: req.file.size,
        isImage,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { uploadChatAttachment };
