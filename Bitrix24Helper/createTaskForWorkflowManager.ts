import moment from "moment-timezone";

import type { EntityId } from "../types/domain.js";
import type { BitrixLead, BitrixTaskAddResult, BitrixUser } from "../types/bitrix.js";

import { callBitrixGetMethod, callBitrixListMethod } from "./bitrixApi.js";

const DEFAULT_WORKFLOW_MANAGER_DEADLINE = "1 hour";

const BUSINESS_START_HOUR = 10;
const BUSINESS_END_HOUR = 18;
const TARGET_TIMEZONE_OFFSET = 3;

export default async function createTaskForWorkflowManager(
    leadId: EntityId,
    userId: EntityId,
    deadlineDuration = DEFAULT_WORKFLOW_MANAGER_DEADLINE
): Promise<EntityId | undefined> {
    const leadData = await callBitrixGetMethod<BitrixLead>(
        "crm.lead.get",
        { ID: leadId },
        `Failed to fetch lead ${leadId} while creating workflow manager task`
    );
    const leadTitle = leadData.TITLE ?? `#${leadId}`;

    const users = await callBitrixListMethod<BitrixUser>(
        "user.get",
        { ID: userId },
        `Failed to fetch user ${userId} while creating workflow manager task`
    );
    const userData = users[0];
    const userName = [userData?.NAME, userData?.LAST_NAME].filter(Boolean).join(" ").trim() || `User ${userId}`;

    const title = `${userName} Look into the Lead ${leadTitle}`;
    const taskDescription =
        `Please reassign the lead with "${leadTitle}" to a sales person` +
        `and update the CRM.\n You have ${deadlineDuration} to make perform this action.\n`;

    const [amount = "1", unit = "hour"] = deadlineDuration.split(" ");
    const nowInTarget = moment().utc().add(TARGET_TIMEZONE_OFFSET, "hours");

    let deadlineBase: moment.Moment;
    const currentHour = nowInTarget.hour();

    if (currentHour < BUSINESS_START_HOUR) {
        deadlineBase = nowInTarget.clone().hour(BUSINESS_START_HOUR).minute(0).second(0);
    } else if (currentHour >= BUSINESS_END_HOUR) {
        deadlineBase = nowInTarget.clone().add(1, "days").hour(BUSINESS_START_HOUR).minute(0).second(0);
    } else {
        deadlineBase = nowInTarget.clone();
    }

    const durationUnit = unit as moment.unitOfTime.DurationConstructor;
    const deadlineTime = deadlineBase.add(parseInt(amount, 10), durationUnit).format("YYYY-MM-DDTHH:mm:ss");

    const taskData = {
        fields: {
            TITLE: title,
            DESCRIPTION: taskDescription,
            DEADLINE: deadlineTime,
            CREATED_BY: Number(userId),
            RESPONSIBLE_ID: Number(userId),
            UF_CRM_TASK: [`L_${leadId}`],
            ALLOW_CHANGE_DEADLINE: "N",
        },
    };

    const createdTask = await callBitrixGetMethod<BitrixTaskAddResult>(
        "tasks.task.add",
        taskData,
        `Failed to create workflow manager task for lead ${leadId}`
    );

    return createdTask.task?.id;
}
