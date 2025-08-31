import express from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT, isAdmin } from "../middlewares/auth.middleware.js";
import {
  submitPaper,
  updatePaper,
  deletePaper,
  updatePaperStatus,
  getAllPapers,
  getUserPapers,
} from "../controllers/paper.controller.js";

const router = express.Router();

// ---------------- Author / Public routes ----------------
router.post(
  "/submit",
  verifyJWT,
  upload.fields([
    { name: "pdfFile", maxCount: 1 },
    { name: "supplementaryPdf", maxCount: 1 },
  ]),
  submitPaper
);

router.put(
  "/update/:paperId",
  verifyJWT,
  upload.fields([
    { name: "pdfFile", maxCount: 1 },
    { name: "supplementaryPdf", maxCount: 1 },
  ]),
  updatePaper
);

router.delete("/delete/:paperId", verifyJWT, deletePaper);

router.get("/user/:email", verifyJWT, getUserPapers);

// ---------------- Admin routes ----------------
router.put("/status/:paperId", verifyJWT, isAdmin, updatePaperStatus);
router.get("/", verifyJWT, isAdmin, getAllPapers);

export default router;
