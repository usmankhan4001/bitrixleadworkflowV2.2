import express from "express";

import leadAddController from "../Controllers/LeadAddController.js";
import taskCommentAddController from "../Controllers/TaskCommentAddController.js";
import leadChangeController from "../Controllers/leadChangeController.js";

const router = express.Router();

router.post("/lead/add", leadAddController);
router.post("/task/comment/add", taskCommentAddController);
router.post("/lead/change", leadChangeController);

export default router;
