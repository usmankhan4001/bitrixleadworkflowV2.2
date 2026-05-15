import fs from "fs/promises";

import { getDataFilePath } from "../services/dataPaths.js";
import type { EntityId, WorkflowStateRecord } from "../types/domain.js";

const STORAGE_FILE_NAME = "leadResponsible.json";

type ResponsibleState = WorkflowStateRecord<EntityId>;

async function loadStorage(): Promise<ResponsibleState> {
    try {
        const data = await fs.readFile(await getDataFilePath(STORAGE_FILE_NAME), "utf8");
        return JSON.parse(data) as ResponsibleState;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return {};
        }

        console.error("Error loading storage:", error);
        return {};
    }
}

async function saveStorage(storage: ResponsibleState): Promise<void> {
    try {
        await fs.writeFile(await getDataFilePath(STORAGE_FILE_NAME), JSON.stringify(storage, null, 2), "utf8");
    } catch (error) {
        console.error("Error saving storage:", error);
    }
}

export async function setResponsible(leadId: EntityId, responsibleId: EntityId): Promise<void> {
    const storage = await loadStorage();
    storage[String(leadId)] = responsibleId;
    await saveStorage(storage);
    console.log(`Set lead ${leadId} -> responsible ${responsibleId}`);
}

export async function getResponsible(leadId: EntityId): Promise<EntityId | null> {
    const storage = await loadStorage();
    return storage[String(leadId)] ?? null;
}
