import type { DepartmentName } from "../Constants/SalesTeam.js";
import type { EntityId, OverdueEscalationDecision } from "../types/domain.js";

type ResolveOverdueEscalationInput = {
    department: DepartmentName | null;
    taskCountForLead: number;
    nextCompletedUser: EntityId | null;
    workflowManagerId: EntityId;
};

export function resolveOverdueEscalation({
    taskCountForLead,
    nextCompletedUser,
    workflowManagerId,
}: ResolveOverdueEscalationInput): OverdueEscalationDecision {
    if (nextCompletedUser && taskCountForLead < 2) {
        return {
            kind: "reassign-sales",
            assignedUserId: nextCompletedUser,
        };
    }

    return {
        kind: "workflow-manager",
        assignedUserId: workflowManagerId,
    };
}
