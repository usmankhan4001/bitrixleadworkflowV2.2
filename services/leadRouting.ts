import type { LeadRoutingDecision } from "../types/domain.js";

const EXCLUDED_SOURCE_ID = "UC_NNO79X";
const TELLY_SALES_SOURCES = new Set(["WEBFORM", "1|FACEBOOK"]);

export function resolveLeadRouting(sourceId?: string): LeadRoutingDecision {
    if (sourceId === EXCLUDED_SOURCE_ID) {
        return { kind: "skip" };
    }

    if (sourceId && TELLY_SALES_SOURCES.has(sourceId)) {
        return { kind: "assign", department: "Telly Sales" };
    }

    return { kind: "assign", department: "Sales Executives" };
}
