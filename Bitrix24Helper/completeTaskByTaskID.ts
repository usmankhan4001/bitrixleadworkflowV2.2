import type { EntityId } from "../types/domain.js";

import { callBitrixGetMethod } from "./bitrixApi.js";

export default async function completeTaskByTaskID(taskId: EntityId): Promise<boolean> {
    try {
        return await callBitrixGetMethod<boolean>("tasks.task.complete", {
            taskId,
        }, `Failed to complete task ${taskId}`);
    } catch (err) {
        console.error(`Error completing task ${taskId}:`, err);
        return false;
    }
}
