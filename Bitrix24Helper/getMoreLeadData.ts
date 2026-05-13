import type { EntityId } from "../types/domain.js";
import type { BitrixLead } from "../types/bitrix.js";

import { callBitrixGetMethod } from "./bitrixApi.js";

export default async function getMoreLeadData(leadId: EntityId): Promise<BitrixLead> {
    return callBitrixGetMethod<BitrixLead>("crm.lead.get", { ID: leadId }, `Failed to fetch lead ${leadId}`);
}
