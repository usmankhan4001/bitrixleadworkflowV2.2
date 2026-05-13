import type { LeadRoutingDecision, WorkflowConfig } from "../types/domain.js";

export function resolveLeadRouting(sourceId: string | undefined, config: WorkflowConfig): LeadRoutingDecision {
    if (sourceId && config.sourceRouting.excludedSourceIds.includes(sourceId)) {
        return { kind: "skip" };
    }

    const matchedRoute = sourceId
        ? config.sourceRouting.routes.find((route) => route.sourceIds.includes(sourceId))
        : null;

    if (matchedRoute) {
        return { kind: "assign", department: matchedRoute.department };
    }

    return { kind: "assign", department: config.sourceRouting.defaultDepartment };
}
