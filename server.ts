import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

import {
    getAuthStatus,
    getAuthorizationUrl,
    handleInstallationCallback,
    handleOAuthRedirect,
    hasBitrixOAuthConfig,
    initB24,
    initializeAuthorizedClient,
} from "./Bitrix24AuthUtils/Bitrix24AuthUtils.js";
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

const requireB24ForWebhook = (_req: Request, res: Response, next: NextFunction): void => {
    if (isB24Initialized) {
        next();
        return;
    }

    console.warn("Webhook received but B24 instance is not ready. Skipping processing.");
    res.status(200).send({ message: "B24 not initialized, skipping webhook." });
};

const requireB24ForAdmin = (_req: Request, res: Response, next: NextFunction): void => {
    if (isB24Initialized) {
        next();
        return;
    }

    res.status(503).send({
        message: "Bitrix24 authorization is not complete yet. Finish OAuth authorization, then reload the app.",
    });
};

app.get("/", (_req: Request, res: Response) => {
    if (isB24Initialized) {
        return res.send("Bitrix24 Integration Server is Running and Authorized.");
    }

    return res.send([
        "Bitrix24 Integration Server is Running but Awaiting Authorization.",
        `Authorize the app here: ${getAuthorizationUrl()}`,
        "Check OAuth status at /auth/status",
    ].join("\n"));
});

app.post("/", (_req: Request, res: Response) => {
    if (fs.existsSync(frontendDistPath)) {
        return res.redirect(303, "/app");
    }

    return res.status(405).send("Application UI is not available yet. Build the frontend or open /auth/callback for OAuth.");
});

app.get("/healthz", (_req: Request, res: Response) => {
    return res.status(200).send({
        ok: true,
        b24Initialized: isB24Initialized,
    });
});

app.get("/auth/status", async (_req: Request, res: Response) => {
    return res.status(200).send({
        ...(await getAuthStatus()),
        b24Initialized: isB24Initialized,
    });
});

app.get("/auth/start", (_req: Request, res: Response) => {
    return res.redirect(302, getAuthorizationUrl());
});

if (fs.existsSync(frontendDistPath)) {
    const appShellHandler = (req: Request, res: Response): Response | void => {
        if (
            typeof req.query.code === "string"
            || typeof req.query.error === "string"
            || typeof req.query.error_description === "string"
        ) {
            const query = new URLSearchParams();
            for (const [key, value] of Object.entries(req.query)) {
                if (typeof value === "string") {
                    query.set(key, value);
                }
            }

            return res.redirect(302, `/auth/callback?${query.toString()}`);
        }

        res.sendFile(path.join(frontendDistPath, "index.html"));
    };

    app.get("/app", appShellHandler);
    app.get(/^\/app(?:\/.*)?$/, appShellHandler);
    app.use("/app", express.static(frontendDistPath));
}

async function completeAuthorization(res: Response, action: () => Promise<void>): Promise<Response> {
    try {
        await action();
        await initializeAuthorizedClient();
        isB24Initialized = true;
        return res.send("App authorized! Tokens saved and loaded. You may close this window and reopen the app.");
    } catch (error) {
        console.error("Authorization Flow Failed during token exchange:", error);
        const message = error instanceof Error ? error.message : "Authorization failed during token exchange.";
        return res.status(500).send(message);
    }
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

    return completeAuthorization(res, async () => {
        console.log("Received authorization code. Exchanging for tokens...");
        await handleOAuthRedirect(code);
    });
});

app.post("/auth/callback", async (req: Request, res: Response) => {
    if (typeof req.body?.code === "string") {
        return completeAuthorization(res, async () => {
            await handleOAuthRedirect(req.body.code as string);
        });
    }

    return completeAuthorization(res, async () => {
        await handleInstallationCallback(req.body as Record<string, unknown>);
    });
});

app.post("/auth/install", async (req: Request, res: Response) => {
    return completeAuthorization(res, async () => {
        await handleInstallationCallback(req.body as Record<string, unknown>);
    });
});

app.use("/api/admin", requireB24ForAdmin, adminRoutes);
app.use("/bitrixworkflow", requireB24ForWebhook, bitrixRoutes);

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
