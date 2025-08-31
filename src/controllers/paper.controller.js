import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Paper } from "../models/paper.model.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { sendEmail } from "../utils/sendEmail.js";

// Helper to extract publicId from Cloudinary URL
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const parts = url.split("/");
  const fileWithExt = parts.pop();
  const publicId = fileWithExt.split(".")[0];
  return parts.slice(7).join("/") + "/" + publicId;
};

// ---------------- Submit Paper ----------------
const submitPaper = asyncHandler(async (req, res) => {
  const { fullname, email, paperTitle, abstract, keywords } = req.body;

  if (!fullname || !email || !paperTitle || !abstract || !keywords) {
    throw new ApiError(400, "All fields except supplementary PDF are required");
  }

  const pdfLocalPath = req.files?.pdfFile?.[0]?.path;
  if (!pdfLocalPath) throw new ApiError(400, "PDF file is required");

  const supplementaryPdfLocalPath = req.files?.supplementaryPdf?.[0]?.path;

  // Upload main PDF
  const pdfUpload = await uploadOnCloudinary(pdfLocalPath);
  if (!pdfUpload) throw new ApiError(500, "Failed to upload PDF file");

  // Upload supplementary PDF
  let supplementaryUpload = null;
  if (supplementaryPdfLocalPath) {
    supplementaryUpload = await uploadOnCloudinary(supplementaryPdfLocalPath);
  }

  const paper = await Paper.create({
    fullname,
    email,
    paperTitle,
    abstract,
    keywords: Array.isArray(keywords) ? keywords : keywords.split(","),
    pdfFileViewerUrl: pdfUpload.iframeUrl,
    pdfFileDownloadUrl: pdfUpload.downloadUrl,
    supplementaryViewerUrl: supplementaryUpload
      ? supplementaryUpload.iframeUrl
      : null,
    supplementaryDownloadUrl: supplementaryUpload
      ? supplementaryUpload.downloadUrl
      : null,
    status: "Submitted",
  });

  // Notify admin
  await sendEmail({
    fromEmail: paper.email,
    to: process.env.ADMIN_EMAIL,
    subject: "New Paper Submitted",
    text: `A new paper titled "${paper.paperTitle}" has been submitted by ${paper.fullname} (${paper.email}).`,
  });

  return res
    .status(201)
    .json(new ApiResponse(200, paper, "Paper submitted successfully"));
});

// ---------------- Update Paper ----------------
const updatePaper = asyncHandler(async (req, res) => {
  const { paperId } = req.params;
  const { paperTitle, abstract, keywords } = req.body;

  let paper = await Paper.findById(paperId);
  if (!paper) throw new ApiError(404, "Paper not found");

  if (req.user.role !== "admin" && req.user.email !== paper.email) {
    throw new ApiError(403, "You cannot edit this paper");
  }

  const updateData = {};
  if (paperTitle) updateData.paperTitle = paperTitle;
  if (abstract) updateData.abstract = abstract;
  if (keywords)
    updateData.keywords = Array.isArray(keywords)
      ? keywords
      : keywords.split(",");
  updateData.status = "Submitted";

  // Update main PDF
  if (req.files?.pdfFile?.[0]?.path) {
    if (paper.pdfFileDownloadUrl) {
      const oldPdfPublicId = getPublicIdFromUrl(paper.pdfFileDownloadUrl);
      if (oldPdfPublicId) await deleteFromCloudinary(oldPdfPublicId);
    }
    const pdfUpload = await uploadOnCloudinary(req.files.pdfFile[0].path);
    if (pdfUpload) {
      updateData.pdfFileViewerUrl = pdfUpload.iframeUrl;
      updateData.pdfFileDownloadUrl = pdfUpload.downloadUrl;
    }
  }

  // Update supplementary PDF
  if (req.files?.supplementaryPdf?.[0]?.path) {
    if (paper.supplementaryDownloadUrl) {
      const oldSupPublicId = getPublicIdFromUrl(paper.supplementaryDownloadUrl);
      if (oldSupPublicId) await deleteFromCloudinary(oldSupPublicId);
    }
    const supUpload = await uploadOnCloudinary(
      req.files.supplementaryPdf[0].path
    );
    if (supUpload) {
      updateData.supplementaryViewerUrl = supUpload.iframeUrl;
      updateData.supplementaryDownloadUrl = supUpload.downloadUrl;
    }
  }

  paper = await Paper.findByIdAndUpdate(paperId, updateData, { new: true });

  // Notify admin
  await sendEmail({
    fromEmail: paper.email,
    to: process.env.ADMIN_EMAIL,
    subject: "Paper Updated",
    text: `The paper titled "${paper.paperTitle}" was updated by ${req.user.fullname} (${req.user.email}). Status has been reset to SUBMITTED for review.`,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        paper,
        "Paper updated successfully, status reset to submitted"
      )
    );
});

// ---------------- Delete Paper ----------------
const deletePaper = asyncHandler(async (req, res) => {
  const { paperId } = req.params;

  const paper = await Paper.findById(paperId);
  if (!paper) throw new ApiError(404, "Paper not found");

  // Only the author (email) or admin can delete
  if (req.user.role !== "admin" && req.user.email !== paper.email) {
    throw new ApiError(403, "You cannot delete this paper");
  }

  await paper.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Paper deleted successfully"));
});

// ---------------- Update Paper Status (Admin only) ----------------
const updatePaperStatus = asyncHandler(async (req, res) => {
  const { paperId } = req.params;
  const { status } = req.body;

  const allowedStatuses = [
    "Submitted",
    "Review Awaiting",
    "Review Obtained",
    "Accept",
    "Reject",
  ];

  if (!allowedStatuses.includes(status)) {
    throw new ApiError(400, "Invalid status value");
  }

  const paper = await Paper.findById(paperId);
  if (!paper) throw new ApiError(404, "Paper not found");

  // Only admin can update status
  if (req.user.role !== "admin") {
    throw new ApiError(403, "Only admin can update the paper status");
  }

  paper.status = status;
  await paper.save();

  // ---------------- Send email to author ----------------
  await sendEmail({
    fromEmail: process.env.ADMIN_EMAIL,
    to: paper.email,
    subject: `Status Update for Your Paper "${paper.paperTitle}"`,
    text: `Hello ${paper.fullname},

Your paper titled "${paper.paperTitle}" has been updated by the admin. 
The new status of your paper is: ${status}.

Regards,
Conference/ICAARTD Team`,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, paper, "Paper status updated and author notified")
    );
});

// ---------------- Get Papers ----------------
const getAllPapers = asyncHandler(async (req, res) => {
  const papers = await Paper.find();
  return res
    .status(200)
    .json(new ApiResponse(200, papers, "Papers fetched successfully"));
});

const getUserPapers = asyncHandler(async (req, res) => {
  const { email } = req.params;
  const papers = await Paper.find({ email });
  return res
    .status(200)
    .json(new ApiResponse(200, papers, "User papers fetched successfully"));
});

export {
  submitPaper,
  updatePaper,
  deletePaper,
  updatePaperStatus,
  getAllPapers,
  getUserPapers,
};
