import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/sendEmail.js";
import { PendingUser } from "../models/pendingUser.model.js";

// Helper to generate access & refresh tokens
const generateAccessAndRefreshToken = async (userId) => {
  const user = await User.findById(userId);

  if (!user) throw new ApiError(400, "User not found");

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  if (!accessToken || !refreshToken) {
    throw new ApiError(400, "Token generation failed");
  }

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

// Register User
const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, password, confirmPassword, role } = req.body;

  if (
    [fullname, email, password, confirmPassword, role].some((f) => !f?.trim())
  ) {
    throw new ApiError(400, "All fields are required");
  }

  if (!email.includes("@")) throw new ApiError(400, "Invalid email address");
  if (password !== confirmPassword)
    throw new ApiError(400, "Passwords do not match");

  // Check if already registered (verified)
  const existedUser = await User.findOne({ email });
  if (existedUser)
    throw new ApiError(409, "User with this email already exists");

  // If user has an old pending record, remove it
  await PendingUser.deleteOne({ email });

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Save in PendingUser (password not hashed yet)
  await PendingUser.create({
    fullname,
    email,
    password,
    role,
    otp,
    otpExpires: Date.now() + 10 * 60 * 1000,
  });

  // Send OTP Email
  await sendEmail({
    to: email,
    subject: "Verify your email",
    text: `Your OTP is ${otp}. It is valid for 10 minutes.`,
  });

  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        { email, role },
        "OTP sent successfully. Please verify your email."
      )
    );
});

// Verify OTP
const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp, role } = req.body;

  if (!email || !otp || !role) {
    throw new ApiError(400, "Email, OTP, and role are required");
  }

  const pending = await PendingUser.findOne({ email, role });
  if (!pending) throw new ApiError(404, "No pending registration found");

  if (pending.otp !== otp || pending.otpExpires < Date.now()) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  // Create actual user
  const user = await User.create({
    fullname: pending.fullname,
    email: pending.email,
    password: pending.password,
    confirmPassword: pending.password,
    role: pending.role,
    isVerified: true,
  });

  // Cleanup pending user
  await PendingUser.deleteOne({ email });

  // Generate tokens
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const verifiedUser = await User.findById(user._id).select(
    "-password -confirmPassword -refreshToken"
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: verifiedUser, accessToken, refreshToken },
        "Email verified successfully"
      )
    );
});

// Resend OTP
const resendOtp = asyncHandler(async (req, res) => {
  const { email, role } = req.body;

  if (!email || !role) {
    throw new ApiError(400, "Email and role are required");
  }

  // Find user in PendingUser collection
  const pending = await PendingUser.findOne({ email, role });
  if (!pending) {
    throw new ApiError(
      404,
      "No pending registration found for this email and role"
    );
  }

  // Generate a new OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  pending.otp = otp;
  pending.otpExpires = Date.now() + 10 * 60 * 1000;

  await pending.save();

  // Send new OTP email
  await sendEmail({
    to: pending.email,
    subject: `Resend OTP for ${role}`,
    text: `Hello ${pending.fullname},\n\nYour new OTP for ${role} verification is ${otp}. It is valid for 10 minutes.\n\nThanks.`,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, `OTP resent successfully for ${role}`));
});

// Login User
const loginUser = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    throw new ApiError(400, "All fields are required");
  }

  // Check if user is stuck in PendingUser
  const pending = await PendingUser.findOne({ email, role });
  if (pending) {
    throw new ApiError(403, "Please verify your email first before logging in");
  }

  // Now check in verified User collection
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    const msg =
      email === process.env.ADMIN_EMAIL
        ? "Admin not registered yet. Please register first."
        : "Author not registered yet. Please register first.";
    throw new ApiError(404, msg);
  }

  // Role validation
  if (role === "admin" && user.role !== "admin") {
    throw new ApiError(
      403,
      "Only official admin can login. Please login as an author."
    );
  }
  if (role === "author" && user.role !== "author") {
    throw new ApiError(
      403,
      "This email is registered as admin. Please login as admin."
    );
  }

  // Check verified flag
  if (!user.isVerified) {
    throw new ApiError(403, "Please verify your email first");
  }

  // Validate password
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Generate tokens
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const loggedInUser = await User.findById(user._id).select(
    "-password -confirmPassword -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

// Logout User
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    { refreshToken: null },
    { new: true }
  );
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

// Refresh Access Token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) throw new ApiError(400, "Refresh token missing");

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken._id);
    if (!user) throw new ApiError(404, "User not found");
    if (incomingRefreshToken !== user.refreshToken)
      throw new ApiError(401, "Invalid or expired refresh token");

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

export {
  registerUser,
  loginUser,
  verifyOtp,
  resendOtp,
  logoutUser,
  refreshAccessToken,
};
