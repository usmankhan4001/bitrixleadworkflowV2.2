import fs from "fs-extra";

import type { DepartmentName } from "../Constants/SalesTeam.js";
import { getDataFilePath } from "../services/dataPaths.js";
import type { EntityId, WorkflowStateRecord } from "../types/domain.js";
import { loadWorkflowConfig } from "../services/workflowConfig.js";

const COMPLETED_USERS_FILE_NAME = "SalesPersonWithCompletedTask.json";

type CompletedUsersState = WorkflowStateRecord<EntityId[]>;

async function createDefaultCompletedUsers(): Promise<CompletedUsersState> {
    const config = await loadWorkflowConfig();
    return Object.fromEntries(config.teams.map((team) => [team.name, []])) as CompletedUsersState;
}

async function loadCompletedUsers(): Promise<CompletedUsersState> {
    const defaultUsers = await createDefaultCompletedUsers();
    const completedUsersFile = await getDataFilePath(COMPLETED_USERS_FILE_NAME);
    if (await fs.pathExists(completedUsersFile)) {
        const storedUsers = await fs.readJson(completedUsersFile) as Partial<CompletedUsersState>;
        const mergedUsers: CompletedUsersState = { ...defaultUsers };
        for (const [department, users] of Object.entries(storedUsers)) {
            mergedUsers[department] = users ?? [];
        }
        return mergedUsers;
    }

    await fs.outputJson(completedUsersFile, defaultUsers, { spaces: 2 });
    return defaultUsers;
}

export async function addUserToCompleted(department: DepartmentName, value: EntityId): Promise<void> {
    const data = await loadCompletedUsers();
    data[department] ??= [];
    if (!data[department].some((currentValue) => String(currentValue) === String(value))) {
        data[department].push(value);
    }
    await fs.outputJson(await getDataFilePath(COMPLETED_USERS_FILE_NAME), data, { spaces: 2 });
}

export async function getFirstCompletedUser(department: DepartmentName): Promise<EntityId | null> {
    const data = await loadCompletedUsers();
    return data[department]?.[0] ?? null;
}

export async function removeUserFromCompleted(department: DepartmentName, value: EntityId): Promise<void> {
    const data = await loadCompletedUsers();
    data[department] = (data[department] ?? []).filter((currentValue) => String(currentValue) !== String(value));
    await fs.outputJson(await getDataFilePath(COMPLETED_USERS_FILE_NAME), data, { spaces: 2 });
}
