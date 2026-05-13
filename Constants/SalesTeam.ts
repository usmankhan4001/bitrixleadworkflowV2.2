import type { EntityId, WorkflowAssignmentDepartment } from "../types/domain.js";
import { DEFAULT_WORKFLOW_CONFIG, getDepartmentByConfiguredUserId, loadWorkflowConfig } from "../services/workflowConfig.js";

export const SALES_TEAM = Object.fromEntries(
    DEFAULT_WORKFLOW_CONFIG.teams.map((team) => [team.name, team.memberIds])
) as Record<WorkflowAssignmentDepartment, EntityId[]>;

export type DepartmentName = WorkflowAssignmentDepartment;

export default async function getDepartmentByUserId(userId: EntityId): Promise<DepartmentName | null> {
    return getDepartmentByConfiguredUserId(await loadWorkflowConfig(), userId);
}
