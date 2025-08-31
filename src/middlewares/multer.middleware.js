import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const originalName = file.originalname;
    const extension = originalName.substring(originalName.lastIndexOf("."));
    const baseName = originalName.substring(0, originalName.lastIndexOf("."));

    cb(null, baseName + "-" + uniqueSuffix + extension);
  },
});

export const upload = multer({ storage });
