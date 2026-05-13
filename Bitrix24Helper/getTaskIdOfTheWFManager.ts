import type { EntityId } from "../types/domain.js";
import type { BitrixTaskListResult } from "../types/bitrix.js";

import { callBitrixGetMethod } from "./bitrixApi.js";

export default async function getTaskIdOfTheWFManager(leadId: EntityId): Promise<EntityId[]> {
    try {
        const taskList = await callBitrixGetMethod<BitrixTaskListResult>("tasks.task.list", {
            filter: { UF_CRM_TASK: `L_${leadId}` },
            select: [
                "ID",
                "TITLE",
                "RESPONSIBLE_ID",
                "DEADLINE",
                "UF_CRM_TASK",
            ],
        }, `Failed to fetch workflow manager tasks for lead ${leadId}`);
        const { tasks } = taskList;
        if (tasks.length === 0) {
            console.log(`No tasks found for lead ${leadId}`);
            return [];
        }

        return tasks
            .filter((task) => task.title?.includes("Look into the Lead"))
            .map((task) => task.id);
    } catch (err) {
        console.error(`Error fetching tasks for lead ${leadId}:`, err);
        return [];
    }
}
