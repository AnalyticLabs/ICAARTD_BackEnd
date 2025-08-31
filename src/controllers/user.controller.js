import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";

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

  // Validate required fields
  if (
    [fullname, email, password, confirmPassword, role].some((f) => !f?.trim())
  ) {
    throw new ApiError(400, "All fields are required");
  }

  if (!email.includes("@")) throw new ApiError(400, "Invalid email address");
  if (password !== confirmPassword)
    throw new ApiError(400, "Passwords do not match");

  // Check if user already exists
  const existedUser = await User.findOne({ email });

  // Admin validation (backend only)
  if (role === "admin") {
    if (email !== process.env.ADMIN_EMAIL) {
      throw new ApiError(
        403,
        "Only official admin can register. Please register as an author."
      );
    }
    if (existedUser) throw new ApiError(409, "Admin already exists");
  } else {
    // Author logic
    if (existedUser)
      throw new ApiError(409, "Author with this email already exists");
  }

  // Create user
  const user = await User.create({
    fullname,
    email,
    password,
    confirmPassword,
    role,
  });

  // Generate tokens immediately
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  // Prepare user object to return (without sensitive fields)
  const createdUser = await User.findById(user._id).select(
    "-password -confirmPassword -refreshToken"
  );

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // only use HTTPS in production
    sameSite: "lax", // allows cookies to be sent for cross-site requests in dev
  };

  // Send response with cookies and user info
  return res
    .status(201)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user: createdUser, accessToken, refreshToken },
        "User registered successfully"
      )
    );
});

// Login User
const loginUser = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role)
    throw new ApiError(400, "All fields are required");

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

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) throw new ApiError(401, "Invalid credentials");

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -confirmPassword -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // only use HTTPS in production
    sameSite: "lax", // allows cookies to be sent for cross-site requests in dev
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
    secure: process.env.NODE_ENV === "production", // only use HTTPS in production
    sameSite: "lax", // allows cookies to be sent for cross-site requests in dev
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
      secure: process.env.NODE_ENV === "production", // only use HTTPS in production
      sameSite: "lax", // allows cookies to be sent for cross-site requests in dev
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

export { registerUser, loginUser, logoutUser, refreshAccessToken };
