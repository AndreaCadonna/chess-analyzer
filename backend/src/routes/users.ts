import { Router, RequestHandler } from "express";
import {
  createUser,
  getUser,
  getAllUsers,
  updateUser,
  deleteUser,
} from "../controllers/userController";

const router = Router();

// User CRUD routes
router.post("/", createUser as RequestHandler);
router.get("/", getAllUsers as RequestHandler);
router.get("/:userId", getUser as RequestHandler);
router.put("/:userId", updateUser as RequestHandler);
router.delete("/:userId", deleteUser as RequestHandler);

export default router;
