import { Router } from "express";
import {
  healthCheck,
  heartCheck,
} from "../controllers/healthcheck.controller.js";

const router = Router();

router.route("/").get(healthCheck);
router.route("/heart").get(heartCheck);

export default router;
