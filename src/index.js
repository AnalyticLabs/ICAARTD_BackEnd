import dotenv from "dotenv";
import { app } from "./app.js";
import { port } from "./constants.js";
import connectDB from "./db/index.js";
import { logger } from "./utils/logger.js";

dotenv.config({ path: "./.env" });

connectDB()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      logger.info(`Server listening at: http://0.0.0.0:${port}`);
    });
  })
  .catch((error) => {
    logger.error(`MongoDB Connection Failed: ${error}`);
  });
