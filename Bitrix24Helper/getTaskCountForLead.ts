import type { EntityId } from "../types/domain.js";
import type { BitrixTaskListResult } from "../types/bitrix.js";

import { callBitrixGetMethod } from "./bitrixApi.js";

export default async function getTaskCountForLead(leadId: EntityId): Promise<number> {
    const taskList = await callBitrixGetMethod<BitrixTaskListResult>("tasks.task.list", {
        filter: {
            UF_CRM_TASK: `L_${leadId}`,
        },
    }, `Failed to fetch task count for lead ${leadId}`);

    const taskCount = taskList.tasks.length;
    console.log("Successfully retrieved task count for lead:", leadId, "Count:", taskCount);
    return taskCount;
}
