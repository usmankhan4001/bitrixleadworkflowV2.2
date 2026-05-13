import type { EntityId } from "../types/domain.js";

import { callBitrixGetMethod } from "./bitrixApi.js";

export default async function changeTheStageOfLead(leadId: EntityId, newStageId: string): Promise<boolean> {
    const result = await callBitrixGetMethod<boolean>("crm.lead.update", {
        id: leadId,
        fields: { STATUS_ID: newStageId },
    }, `Failed to update stage for lead ${leadId}`);
    if (result) {
        console.log(`Lead ${leadId} stage changed to ${newStageId} successfully.`);
    }

    return result;
}
