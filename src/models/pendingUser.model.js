import mongoose, { Schema } from "mongoose";

const pendingUserSchema = new Schema(
  {
    fullname: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "author"],
      default: "author",
    },
    otp: {
      type: String,
      required: true,
    },
    otpExpires: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

export const PendingUser = mongoose.model("PendingUser", pendingUserSchema);
