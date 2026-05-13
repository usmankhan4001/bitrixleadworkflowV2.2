import type { Request, Response } from "express";

import getMoreLeadData from "../Bitrix24Helper/getMoreLeadData.js";
import { SALES_TEAM } from "../Constants/SalesTeam.js";
import createTask from "../Bitrix24Helper/createTaskForSalesPerson.js";
import { getAndIncrementIndex } from "../Bitrix24Helper/handleSalesIndex.js";
import updateResponsiblePerson from "../Bitrix24Helper/updateResponsiblePerson.js";
import { setResponsible } from "../Bitrix24Helper/handleOldValueOfResponsiblePerson.js";
import { resolveLeadRouting } from "../services/leadRouting.js";
import type { LeadAddWebhookBody } from "../types/domain.js";

export default async function leadAddController(
    req: Request<Record<string, never>, unknown, LeadAddWebhookBody>,
    res: Response
): Promise<Response> {
    console.log("LeadAddController called with the following data:", req.body);

    const leadId = req.body?.data?.FIELDS?.ID;
    if (!leadId) {
        return res.status(200).send({ message: "Missing lead ID. No action taken." });
    }

    const additionalLeadData = await getMoreLeadData(leadId);
    console.log("Additional lead data:", additionalLeadData);

    const routingDecision = resolveLeadRouting(additionalLeadData.SOURCE_ID);
    if (routingDecision.kind === "skip") {
        return res.status(200).send({ message: "Lead from excluded source. No action taken." });
    }

    const salesIndexToAssign = await getAndIncrementIndex(routingDecision.department);
    const assignedUserId = SALES_TEAM[routingDecision.department][salesIndexToAssign];
    if (typeof assignedUserId === "undefined") {
        throw new Error(`No sales user configured for ${routingDecision.department} at index ${salesIndexToAssign}`);
    }

    await updateResponsiblePerson(leadId, assignedUserId);
    await createTask(leadId, assignedUserId);
    await setResponsible(leadId, assignedUserId);

    return res.status(200).send({ message: "Lead received and processing started." });
}
