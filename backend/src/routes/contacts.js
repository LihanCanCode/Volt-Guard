import { Router } from "express";
import { listContacts, insertContact, deleteContact } from "../db/db.js";

const router = Router();

router.get("/", (req, res) => {
  res.json(listContacts());
});

router.post("/", (req, res) => {
  const { name, relationship } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }
  const contact = insertContact({ name: name.trim(), relationship: relationship?.trim() || null });
  res.status(201).json(contact);
});

router.delete("/:id", (req, res) => {
  deleteContact(Number(req.params.id));
  res.status(204).end();
});

export default router;
