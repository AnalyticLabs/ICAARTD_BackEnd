import mongoose, { Schema } from "mongoose";

const paperSchema = new Schema(
  {
    fullname: {
      type: String,
      required: [true, "Full name is required"],
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },
    paperTitle: {
      type: String,
      required: [true, "Paper title is required"],
      trim: true,
    },
    abstract: {
      type: String,
      required: [true, "Abstract is required"],
    },
    keywords: {
      type: [String],
      required: [true, "At least one keyword is required"],
    },
    // PDF file URLs
    pdfFileViewerUrl: {
      type: String,
      required: [true, "PDF view URL is required"],
    },
    pdfFileDownloadUrl: {
      type: String,
      required: [true, "PDF download URL is required"],
    },
    pdfFilePublicId: {
      type: String,
      required: [true, "PDF public_id is required"],
    },

    // Supplementary PDF URLs
    supplementaryViewerUrl: { type: String, default: null },
    supplementaryDownloadUrl: { type: String, default: null },
    supplementaryPublicId: { type: String, default: null },
    status: {
      type: String,
      enum: [
        "Submitted",
        "Review Awaiting",
        "Review Obtained",
        "Accept",
        "Reject",
      ],
      default: "Submitted",
    },
  },
  { timestamps: true }
);

export const Paper = mongoose.model("Paper", paperSchema);
