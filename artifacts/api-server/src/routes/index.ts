import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import chatsRouter from "./chats.js";
import uploadRouter from "./upload.js";

const router = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/chats", chatsRouter);
router.use("/upload", uploadRouter);
router.use("/uploads", uploadRouter);

export default router;
