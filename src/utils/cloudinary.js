import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { logger } from "./logger.js";
import dotenv from "dotenv";
import { logger } from "./utils/logger.js";

dotenv.config();

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  if (!localFilePath) return null;

  const removeLocalFile = async () => {
    try {
      if (fs.existsSync(localFilePath)) {
        await fs.promises.unlink(localFilePath);
        logger.info(`Deleted local file: ${localFilePath}`);
      }
    } catch (err) {
      logger.error(`Failed to delete local file: ${localFilePath}`, err);
    }
  };

  try {
    if (!localFilePath.toLowerCase().endsWith(".pdf")) {
      throw new Error("Only PDF files are allowed");
    }

    const response = await cloudinary.uploader.upload(localFilePath, {
      // resource_type: "raw",
      folder: "pdf_files",
      use_filename: true,
      unique_filename: false,
      // overwrite: true,
    });

    console.log("Pdf URL: ", response.url);
    console.log("Secure_URL: ", response.secure_url);

    await removeLocalFile();

    if (!response.secure_url)
      throw new Error("Cloudinary response missing URL");

    return {
      ...response,
      iframeUrl: response.secure_url,
      downloadUrl: `${response.secure_url}?fl_attachment`,
    };
  } catch (error) {
    await removeLocalFile();
    logger.error("Cloudinary upload error:", error);
    return null;
  }
};

const deleteFromCloudinary = async (publicId, resource_type = "auto") => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type });
    return true;
  } catch (error) {
    throw new Error(error?.message || "Failed to delete image from Cloudinary");
  }
};

export { uploadOnCloudinary, deleteFromCloudinary };
