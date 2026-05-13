import type { Request, Response } from "express";

import getMoreLeadData from "../Bitrix24Helper/getMoreLeadData.js";
import { SALES_TEAM } from "../Constants/SalesTeam.js";
import createTask from "../Bitrix24Helper/createTaskForSalesPerson.js";
import { getAndIncrementIndex } from "../Bitrix24Helper/handleSalesIndex.js";
import updateResponsiblePerson from "../Bitrix24Helper/updateResponsiblePerson.js";
import { setResponsible } from "../Bitrix24Helper/handleOldValueOfResponsiblePerson.js";

type LeadAddWebhookBody = {
    data?: {
        FIELDS?: {
            ID?: string | number;
        };
    };
};

type LeadDetails = {
    SOURCE_ID?: string;
};

export default async function leadAddController(
    req: Request<unknown, unknown, LeadAddWebhookBody>,
    res: Response
): Promise<Response> {
    console.log("LeadAddController called with the following data:", req.body);

    const leadId = req.body?.data?.FIELDS?.ID;
    if (!leadId) {
        return res.status(200).send({ message: "Missing lead ID. No action taken." });
    }

    const additionalLeadData = await getMoreLeadData(leadId) as LeadDetails;
    console.log("Additional lead data:", additionalLeadData);

    if (additionalLeadData?.SOURCE_ID === "UC_NNO79X") {
        return res.status(200).send({ message: "Lead from excluded source. No action taken." });
    }

    if (additionalLeadData?.SOURCE_ID === "WEBFORM" || additionalLeadData?.SOURCE_ID === "1|FACEBOOK") {
        const salesIndexToAssign = await getAndIncrementIndex("Telly Sales");
        const assignedUserId = SALES_TEAM["Telly Sales"][salesIndexToAssign];

        await updateResponsiblePerson(leadId, assignedUserId);
        await createTask(leadId, assignedUserId);
        await setResponsible(leadId, assignedUserId);
    } else {
        const salesIndexToAssign = await getAndIncrementIndex("Sales Executives");
        const assignedUserId = SALES_TEAM["Sales Executives"][salesIndexToAssign];

        await updateResponsiblePerson(leadId, assignedUserId);
        await createTask(leadId, assignedUserId);
        await setResponsible(leadId, assignedUserId);
    }

    return res.status(200).send({ message: "Lead received and processing started." });
}
