import fs from "fs-extra";
import path from "path";

import type { DepartmentName } from "../Constants/SalesTeam.js";
import type { EntityId, WorkflowStateRecord } from "../types/domain.js";

const COMPLETED_USERS_FILE = path.join("/mnt/data", "SalesPersonWithCompletedTask.json");

type CompletedUsersState = WorkflowStateRecord<EntityId[]> & Record<DepartmentName, EntityId[]>;

function createDefaultCompletedUsers(): CompletedUsersState {
    return {
        "Sales Executives": [],
        "Telly Sales": [],
    };
}

async function loadCompletedUsers(): Promise<CompletedUsersState> {
    if (await fs.pathExists(COMPLETED_USERS_FILE)) {
        const storedUsers = await fs.readJson(COMPLETED_USERS_FILE) as Partial<CompletedUsersState>;
        return {
            "Sales Executives": storedUsers["Sales Executives"] ?? [],
            "Telly Sales": storedUsers["Telly Sales"] ?? [],
        };
    }

    const defaultData = createDefaultCompletedUsers();
    await fs.outputJson(COMPLETED_USERS_FILE, defaultData, { spaces: 2 });
    return defaultData;
}

export async function addUserToCompleted(department: DepartmentName, value: EntityId): Promise<void> {
    const data = await loadCompletedUsers();
    data[department].push(value);
    await fs.outputJson(COMPLETED_USERS_FILE, data, { spaces: 2 });
}

export async function getFirstCompletedUser(department: DepartmentName): Promise<EntityId | null> {
    const data = await loadCompletedUsers();
    return data[department][0] ?? null;
}

export async function removeUserFromCompleted(department: DepartmentName, value: EntityId): Promise<void> {
    const data = await loadCompletedUsers();
    data[department] = data[department].filter((currentValue) => currentValue !== value);
    await fs.outputJson(COMPLETED_USERS_FILE, data, { spaces: 2 });
}
