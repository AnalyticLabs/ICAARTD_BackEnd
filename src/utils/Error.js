import { logger } from "./logger.js";
import { ApiError } from "./ApiError.js";

export const errorHandler = (err, req, res, next) => {
  // If it's an instance of ApiError, use its status and message
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors || [],
      data: null,
    });
  }

  // For unknown errors
  logger.error(err);
  return res.status(500).json({
    success: false,
    message: err.message || "Something went wrong",
    errors: [],
    data: null,
  });
};
