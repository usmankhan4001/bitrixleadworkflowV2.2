import fs from "fs-extra";
import path from "path";

import { SALES_TEAM, type DepartmentName } from "../Constants/SalesTeam.js";

const COMPLETED_USERS_FILE = path.join("/mnt/data", "SalesPersonWithCompletedTask.json");

type CompletedUsersState = Record<DepartmentName, Array<string | number>>;

function createDefaultCompletedUsers(): CompletedUsersState {
    return Object.fromEntries(
        Object.keys(SALES_TEAM).map((department) => [department, []])
    ) as unknown as CompletedUsersState;
}

async function loadCompletedUsers(): Promise<CompletedUsersState> {
    if (await fs.pathExists(COMPLETED_USERS_FILE)) {
        const storedUsers = await fs.readJson(COMPLETED_USERS_FILE) as Partial<CompletedUsersState>;
        return {
            ...createDefaultCompletedUsers(),
            ...storedUsers,
        };
    }

    const defaultData = createDefaultCompletedUsers();
    await fs.outputJson(COMPLETED_USERS_FILE, defaultData, { spaces: 2 });
    return defaultData;
}

export async function addUserToCompleted(department: DepartmentName, value: string | number): Promise<void> {
    const data = await loadCompletedUsers();
    data[department].push(value);
    await fs.outputJson(COMPLETED_USERS_FILE, data, { spaces: 2 });
}

export async function getFirstCompletedUser(department: DepartmentName): Promise<string | number | null> {
    const data = await loadCompletedUsers();
    return data[department][0] ?? null;
}

export async function removeUserFromCompleted(department: DepartmentName, value: string | number): Promise<void> {
    const data = await loadCompletedUsers();
    data[department] = data[department].filter((currentValue) => currentValue !== value);
    await fs.outputJson(COMPLETED_USERS_FILE, data, { spaces: 2 });
}
