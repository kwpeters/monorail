import * as url from "node:url";
import * as path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import cors, {type CorsOptions} from "cors";
import { router as indexRouter } from "./routes/index.mjs";
import { router as usersRouter } from "./routes/users.mjs";
import { morganMiddleware } from "./morganMiddleware.mjs";


const __dirname = url.fileURLToPath(new URL(".", import.meta.url));


export const app = express();



const whitelist = ["http://example1.com", "http://example2.com"];

const corsOptions: CorsOptions = {
    origin: function (origin, callback) {

        // Don't block REST tools or server-to-server requests.
        const allow = !origin;

        if (allow || whitelist.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
};
const corsMiddleware = cors(corsOptions);


// To allow pre-flight requests associated with "complex" (DELETE requests and
// requests with custom headers), add an OPTIONS handler to all routes.
app.options("/*path", corsMiddleware);

// Other options include:
// app.use(corsMiddleware);
//
// Allow all CORS requests.
// app.use(cors());


app.use(morganMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);
