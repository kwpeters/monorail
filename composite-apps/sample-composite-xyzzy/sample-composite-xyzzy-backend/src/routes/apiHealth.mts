import express from "express";


export const router = express.Router();


// GET /api/health
router.get("/health", function (_req, res) {
    res.json({ ok: true });
});
