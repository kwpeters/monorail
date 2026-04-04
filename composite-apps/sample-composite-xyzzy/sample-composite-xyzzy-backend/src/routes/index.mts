import * as url from "node:url";
import path from "path";
import express from "express";


const __dirname = url.fileURLToPath(new URL(".", import.meta.url));


export const router = express.Router();

/* GET home page. */
router.get("/", function (req, res, next) {
    res.sendFile("index.html", { root: path.join(__dirname, "../public") });
});
