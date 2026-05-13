import type { EntityId } from "../types/domain.js";
import type { BitrixTask, BitrixTaskListResult } from "../types/bitrix.js";

import { callBitrixGetMethod } from "./bitrixApi.js";

export default async function getTaskInfo(taskId: EntityId): Promise<BitrixTask | null> {
    const taskList = await callBitrixGetMethod<BitrixTaskListResult>("tasks.task.list", {
        filter: { ID: taskId },
        select: [
            "ID",
            "TITLE",
            "RESPONSIBLE_ID",
            "DEADLINE",
            "UF_CRM_TASK",
        ],
    }, `Failed to fetch task ${taskId}`);

    return taskList.tasks[0] ?? null;
}
