import fs from "fs-extra";
import path from "path";

import type { DepartmentName } from "../Constants/SalesTeam.js";
import type { EntityId, WorkflowStateRecord } from "../types/domain.js";
import { loadWorkflowConfig } from "../services/workflowConfig.js";

const COMPLETED_USERS_FILE = path.join("/mnt/data", "SalesPersonWithCompletedTask.json");

type CompletedUsersState = WorkflowStateRecord<EntityId[]>;

async function createDefaultCompletedUsers(): Promise<CompletedUsersState> {
    const config = await loadWorkflowConfig();
    return Object.fromEntries(config.teams.map((team) => [team.name, []])) as CompletedUsersState;
}

async function loadCompletedUsers(): Promise<CompletedUsersState> {
    const defaultUsers = await createDefaultCompletedUsers();
    if (await fs.pathExists(COMPLETED_USERS_FILE)) {
        const storedUsers = await fs.readJson(COMPLETED_USERS_FILE) as Partial<CompletedUsersState>;
        const mergedUsers: CompletedUsersState = { ...defaultUsers };
        for (const [department, users] of Object.entries(storedUsers)) {
            mergedUsers[department] = users ?? [];
        }
        return mergedUsers;
    }

    await fs.outputJson(COMPLETED_USERS_FILE, defaultUsers, { spaces: 2 });
    return defaultUsers;
}

export async function addUserToCompleted(department: DepartmentName, value: EntityId): Promise<void> {
    const data = await loadCompletedUsers();
    data[department] ??= [];
    data[department].push(value);
    await fs.outputJson(COMPLETED_USERS_FILE, data, { spaces: 2 });
}

export async function getFirstCompletedUser(department: DepartmentName): Promise<EntityId | null> {
    const data = await loadCompletedUsers();
    return data[department]?.[0] ?? null;
}

export async function removeUserFromCompleted(department: DepartmentName, value: EntityId): Promise<void> {
    const data = await loadCompletedUsers();
    data[department] = (data[department] ?? []).filter((currentValue) => currentValue !== value);
    await fs.outputJson(COMPLETED_USERS_FILE, data, { spaces: 2 });
}
