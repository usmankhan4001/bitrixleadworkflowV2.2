import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

import { getAuthorizationUrl, handleOAuthRedirect, hasBitrixOAuthConfig, initB24 } from "./Bitrix24AuthUtils/Bitrix24AuthUtils.js";
import adminRoutes from "./routes/adminRoutes.js";
import bitrixRoutes from "./routes/routes.js";

const app = express();
const PORT = process.env.PORT || 3000;
const frontendDistPath = path.join(process.cwd(), "frontend", "dist");

app.use(cors({
    origin: [
        "https://inventory.pcirealestate.site",
        "https://bookingform.pcirealestate.site",
        "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));

app.options(/.*/, cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let isB24Initialized = false;

const requireB24 = (_req: Request, res: Response, next: NextFunction): void => {
    if (isB24Initialized) {
        next();
        return;
    }

    console.warn("Webhook received but B24 instance is not ready. Skipping processing.");
    res.status(200).send({ message: "B24 not initialized, skipping webhook." });
};

app.get("/", (_req: Request, res: Response) => {
    if (isB24Initialized) {
        return res.send("Bitrix24 Integration Server is Running and Authorized.");
    }

    return res.send("Bitrix24 Integration Server is Running but Awaiting Authorization.");
});

app.get("/healthz", (_req: Request, res: Response) => {
    return res.status(200).send({
        ok: true,
        b24Initialized: isB24Initialized,
    });
});

if (fs.existsSync(frontendDistPath)) {
    app.use("/app", express.static(frontendDistPath));
    app.get(/^\/app(?:\/.*)?$/, (_req: Request, res: Response) => {
        res.sendFile(path.join(frontendDistPath, "index.html"));
    });
}

app.get("/auth/callback", async (req: Request, res: Response) => {
    if (req.query.error || req.query.error_description) {
        const error = String(req.query.error_description || req.query.error || "Unknown error during authorization.");
        console.error(`Bitrix Error on Redirect: ${error}`);
        return res.status(400).send(`Authorization failed (Bitrix error): ${error}`);
    }

    const code = req.query.code;
    if (typeof code !== "string") {
        return res.status(400).send("Authorization code is missing.");
    }

    try {
        console.log("Received authorization code. Exchanging for tokens...");
        await handleOAuthRedirect(code);

        console.log("App authorized! Tokens saved. Restarting service to load tokens...");
        res.send("App authorized! Tokens saved. You may close this window. Service is restarting...");

        setImmediate(() => {
            process.exit(0);
        });

        return;
    } catch (error) {
        console.error("Authorization Flow Failed during token exchange:", error);
        return res.status(500).send("Authorization failed during token exchange.");
    }
});

app.use("/api/admin", requireB24, adminRoutes);
app.use("/bitrixworkflow", requireB24, bitrixRoutes);

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    try {
        if (!hasBitrixOAuthConfig()) {
            console.warn("Bitrix OAuth environment variables are missing. Set BITRIX_CLIENT_ID and BITRIX_CLIENT_SECRET in Dokploy before authorizing the app.");
            return;
        }

        const b24Instance = await initB24();
        if (!b24Instance) {
            console.log(`Open this URL to authorize the app: ${getAuthorizationUrl()}`);
            return;
        }

        console.log("Bitrix24 instance initialized/loaded.");
        isB24Initialized = true;
    } catch (error) {
        console.error("Failed to initialize B24:", error);
    }
});
