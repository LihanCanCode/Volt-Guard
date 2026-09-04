import { Router } from "express";
import { listEvents } from "../db/db.js";

const router = Router();

router.get("/", (req, res) => {
  res.json(listEvents());
});

export default router;
