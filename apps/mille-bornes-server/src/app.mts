import * as url from "node:url";
import * as path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import cors, {type CorsOptions} from "cors";
import { pipe } from "@repo/depot/pipe2";
import { morganMiddleware } from "./morganMiddleware.mjs";
import {mount as mountPlayers} from "./routes/players.mjs";


const __dirname = url.fileURLToPath(new URL(".", import.meta.url));


export const app = express();


const corsMiddleware = pipe(
    [
        // Requests from a local SvelteKit app
        "http://localhost:5173",
        // Eventual production  frontend domain (replace with your actual production domain)
        // "https://your-production-domain.com"
    ],
    (whitelist) => ({
        origin: function (origin, callback) {
            // Don't block REST tools or server-to-server requests.
            const allow = !origin;
            if (allow || whitelist.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(new Error("Not allowed by CORS."));
            }
        },
        credentials: true
    } satisfies CorsOptions),
    (corsOptions) => cors(corsOptions)
);


// To allow pre-flight requests associated with "complex" (DELETE requests and
// requests with custom headers), add an OPTIONS handler to all routes.
app.options("/*path", corsMiddleware);


app.use(corsMiddleware);
app.use(morganMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// app.use("/", indexRouter);
// app.use("/new-game", newGameRouter);

mountPlayers(app);
