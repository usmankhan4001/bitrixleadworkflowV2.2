import express, { type NextFunction, type Request, type Response } from "express";

import { evaluateAdminAccess, getBitrixCurrentUser, getRequestUserId, isAdminFlag, parseAdminUserIds } from "../services/adminAccess.js";
import { loadWorkflowConfigView, saveRoundRobinIndices, saveWorkflowConfig } from "../services/workflowConfig.js";
import type { WorkflowConfig, WorkflowConfigView } from "../types/domain.js";

type AdminRequest = Request<Record<string, never>, unknown, WorkflowConfig>;

const router = express.Router();

async function resolveAdminAccess(req: Request) {
    const currentUser = await getBitrixCurrentUser();
    const userId = currentUser?.ID ?? getRequestUserId(req);
    const isBitrixAdmin = isAdminFlag(currentUser?.ADMIN);
    return evaluateAdminAccess(userId, isBitrixAdmin, parseAdminUserIds(process.env.ADMIN_USER_IDS));
}

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    const access = await resolveAdminAccess(req);
    if (!access.allowed) {
        res.status(403).send({ message: "Administrator access is required.", access });
        return;
    }

    res.locals.adminAccess = access;
    next();
}

router.get("/me", async (req: Request, res: Response) => {
    const access = await resolveAdminAccess(req);
    return res.status(access.allowed ? 200 : 403).send(access);
});

router.get("/workflow-config", requireAdmin, async (_req: Request, res: Response<WorkflowConfigView>) => {
    return res.send(await loadWorkflowConfigView());
});

router.put("/workflow-config", requireAdmin, async (req: AdminRequest, res: Response) => {
    try {
        return res.send(await saveWorkflowConfig(req.body));
    } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid workflow configuration.";
        return res.status(400).send({ message });
    }
});

router.put("/workflow-config/indices", requireAdmin, async (req: Request<Record<string, never>, unknown, { roundRobinIndices?: Record<string, number> }>, res: Response) => {
    const config = await loadWorkflowConfigView();
    const requestedIndices = req.body.roundRobinIndices ?? {};
    const nextIndices = Object.fromEntries(
        config.teams.map((team) => [team.name, Number(requestedIndices[team.name] ?? 0)])
    );

    await saveRoundRobinIndices(nextIndices);
    return res.send({
        ...config,
        roundRobinIndices: nextIndices,
    });
});

export default router;
