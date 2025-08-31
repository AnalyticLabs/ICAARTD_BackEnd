import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const healthCheck = asyncHandler(async (req, res) => {
  return res
    .status(201)
    .json(new ApiResponse(200, "OK", "HealthCheck Created Successfully!"));
});

const heartCheck = asyncHandler(async (req, res) => {
  return res
    .status(201)
    .json(new ApiResponse(200, "OK", "Heart Checked Successfully!"));
});

export { healthCheck, heartCheck };
