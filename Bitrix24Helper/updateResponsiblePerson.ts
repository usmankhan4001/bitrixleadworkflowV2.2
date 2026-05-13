import type { EntityId } from "../types/domain.js";

import { callBitrixGetMethod } from "./bitrixApi.js";

export default async function updateResponsiblePerson(leadId: EntityId, newResponsibleId: EntityId): Promise<boolean> {
    try {
        console.log(`Successfully updated lead ${leadId} responsible person to ${newResponsibleId}.`);
        return await callBitrixGetMethod<boolean>("crm.lead.update", {
            id: leadId,
            fields: {
                ASSIGNED_BY_ID: newResponsibleId,
            },
        }, `Failed to update lead ${leadId} responsible person`);
    } catch (err) {
        console.error(`Exception in updateResponsiblePerson for lead ${leadId}:`, err);
        throw err;
    }
}
