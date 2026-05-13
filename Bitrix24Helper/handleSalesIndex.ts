import fs from "fs-extra";
import path from "path";

import { SALES_TEAM, type DepartmentName } from "../Constants/SalesTeam.js";

const SALES_INDEX_FILE = path.join("/mnt/data", "sales_indices.json");

type SalesIndexState = Record<DepartmentName, number>;

function createDefaultIndices(): SalesIndexState {
    return {
        "Sales Executives": 0,
        "Telly Sales": 0,
    };
}

async function loadAllIndices(): Promise<SalesIndexState> {
    try {
        if (await fs.pathExists(SALES_INDEX_FILE)) {
            const storedIndices = await fs.readJson(SALES_INDEX_FILE) as Partial<Record<DepartmentName, number>>;
            return {
                ...createDefaultIndices(),
                ...storedIndices,
            };
        }

        const defaultIndices = createDefaultIndices();
        await fs.outputJson(SALES_INDEX_FILE, defaultIndices, { spaces: 2 });
        return defaultIndices;
    } catch (error) {
        console.error("Error loading indices, resetting...", error);
        const defaultIndices = createDefaultIndices();
        await fs.outputJson(SALES_INDEX_FILE, defaultIndices, { spaces: 2 });
        return defaultIndices;
    }
}

export async function getAndIncrementIndex(department: DepartmentName): Promise<number> {
    const indices = await loadAllIndices();
    const team = SALES_TEAM[department];

    if (!team) {
        throw new Error(`Department '${department}' not found.`);
    }

    const currentIndex = indices[department] ?? 0;
    const nextIndex = (currentIndex + 1) % team.length;

    indices[department] = nextIndex;
    await fs.outputJson(SALES_INDEX_FILE, indices, { spaces: 2 });

    return currentIndex;
}
