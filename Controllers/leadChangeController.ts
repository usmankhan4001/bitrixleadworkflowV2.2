import type { Request, Response } from "express";

import { getResponsible } from "../Bitrix24Helper/handleOldValueOfResponsiblePerson.js";
import getMoreLeadData from "../Bitrix24Helper/getMoreLeadData.js";
import getTaskIdOfTheWFManager from "../Bitrix24Helper/getTaskIdOfTheWFManager.js";
import completeTaskByTaskID from "../Bitrix24Helper/completeTaskByTaskID.js";
import createTaskForSalesPerson from "../Bitrix24Helper/createTaskForSalesPerson.js";

type LeadChangeWebhookBody = {
    data?: {
        FIELDS?: {
            ID?: string | number;
        };
    };
};

type LeadChangeDetails = {
    ASSIGNED_BY_ID?: string | number;
    MODIFY_BY_ID?: string | number;
};

export default async function leadChangeController(
    req: Request<unknown, unknown, LeadChangeWebhookBody>,
    res: Response
): Promise<Response> {
    console.log("leadChangeController called with the following data:", req.body);

    const leadId = req.body?.data?.FIELDS?.ID;
    if (!leadId) {
        return res.status(200).send({ message: "Missing lead ID. No action taken." });
    }

    const workflowManager = String(process.env.WORKFLOW_MANAGER || 1);
    const oldResponsibleId = await getResponsible(leadId);
    const moreLeadData = await getMoreLeadData(leadId) as LeadChangeDetails;
    const newResponsibleId = moreLeadData.ASSIGNED_BY_ID;
    const lastModifiedById = moreLeadData.MODIFY_BY_ID;

    console.log(`Old responsible ID for lead ${leadId} is ${oldResponsibleId}`);

    if (
        oldResponsibleId &&
        String(oldResponsibleId) === workflowManager &&
        lastModifiedById &&
        String(lastModifiedById) === workflowManager &&
        String(oldResponsibleId) !== String(newResponsibleId)
    ) {
        console.log(
            `Responsible person for lead ${leadId} changed from ${oldResponsibleId} to ${newResponsibleId} by user ${lastModifiedById}`
        );

        const taskIds = await getTaskIdOfTheWFManager(leadId) as Array<string | number>;
        console.log(`Fetching task id of the workflow manager: ${taskIds}`);

        for (const taskId of taskIds) {
            await completeTaskByTaskID(taskId);
        }

        if (newResponsibleId) {
            await createTaskForSalesPerson(leadId, newResponsibleId);
        }
    }

    return res.status(200).send({ message: "Lead change received." });
}
