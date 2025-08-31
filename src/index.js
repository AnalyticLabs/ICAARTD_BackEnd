import dotenv from "dotenv";
import { app } from "./app.js";
import { port } from "./constants.js";
import connectDB from "./db/index.js";
import { logger } from "./utils/logger.js";

dotenv.config({ path: "./.env" });

connectDB()
  .then(() => {
    app.listen(port, () => {
      logger.info(`Server listening at: http://localhost:${port}`);
    });
  })
  .catch((error) => {
    logger.error(`MongoDB Connection Failed: ${error}`);
  });
