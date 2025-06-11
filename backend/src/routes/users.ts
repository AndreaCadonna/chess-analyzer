import { Router } from "express";
import {
  createUser,
  getUser,
  getAllUsers,
  updateUser,
  deleteUser,
} from "../controllers/userController";

const router = Router();

// User CRUD routes
router.post("/", createUser);
router.get("/", getAllUsers);
router.get("/:userId", getUser);
router.put("/:userId", updateUser);
router.delete("/:userId", deleteUser);

export default router;
