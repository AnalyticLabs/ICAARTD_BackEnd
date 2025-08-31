import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

const verifyJWT = asyncHandler(async (req, _, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthorized - No token provided");
  }

  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken._id).select(
      "-password -confirmPassword -refreshToken"
    );

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, "Invalid or expired token");
  }
});

// Check Admin middleware
const isAdmin = asyncHandler(async (req, _, next) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  // Allow only the fixed admin email
  if (req.user.email !== process.env.ADMIN_EMAIL) {
    throw new ApiError(403, "Admin access only");
  }

  next();
});

export { verifyJWT, isAdmin };
