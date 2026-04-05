import express from "express";
import { z } from "zod";
import { createItem, getItems, getItemById, updateItem } from "../domain/itemService.mjs";


export const router = express.Router();


const createBodySchema = z.object({
    name:        z.string().min(1),
    description: z.string()
});


const updateBodySchema = z.object({
    name:        z.string().min(1).optional(),
    description: z.string().optional()
});


// GET /api/items
router.get("/", function (_req, res) {
    res.json(getItems());
});


// GET /api/items/:id
router.get("/:id", function (req, res) {
    const id = req.params.id;
    const item = getItemById(id);
    if (!item) {
        res.status(404).json({ error: "Item not found" });
        return;
    }
    res.json(item);
});


// POST /api/items
router.post("/", function (req, res) {
    const result = createBodySchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: "Invalid request body", details: result.error.issues });
        return;
    }
    const item = createItem(result.data.name, result.data.description);
    res.status(201).json(item);
});


// PUT /api/items/:id
router.put("/:id", function (req, res) {
    const id = req.params.id;
    const result = updateBodySchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ error: "Invalid request body", details: result.error.issues });
        return;
    }
    const item = updateItem(id, result.data.name, result.data.description);
    if (!item) {
        res.status(404).json({ error: "Item not found" });
        return;
    }
    res.json(item);
});
