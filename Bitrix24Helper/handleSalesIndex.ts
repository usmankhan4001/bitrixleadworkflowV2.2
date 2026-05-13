import type { DepartmentName } from "../Constants/SalesTeam.js";
import { getTeam, loadRoundRobinIndices, loadWorkflowConfig, saveRoundRobinIndices } from "../services/workflowConfig.js";

export async function getAndIncrementIndex(department: DepartmentName): Promise<number> {
    const config = await loadWorkflowConfig();
    const indices = await loadRoundRobinIndices(config);
    const team = getTeam(config, department);
    if (!team) {
        throw new Error(`Department '${department}' not found.`);
    }

    const currentIndex = indices[department] ?? 0;
    const nextIndex = (currentIndex + 1) % team.memberIds.length;

    indices[department] = nextIndex;
    await saveRoundRobinIndices(indices);

    return currentIndex;
}
