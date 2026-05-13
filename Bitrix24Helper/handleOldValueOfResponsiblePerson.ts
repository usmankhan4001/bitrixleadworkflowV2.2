import fs from "fs/promises";

const STORAGE_PATH = "/mnt/data/leadResponsible.json";

type LeadId = string | number;
type ResponsibleId = string | number;
type ResponsibleState = Record<string, ResponsibleId>;

async function loadStorage(): Promise<ResponsibleState> {
    try {
        const data = await fs.readFile(STORAGE_PATH, "utf8");
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
        await fs.writeFile(STORAGE_PATH, JSON.stringify(storage, null, 2), "utf8");
    } catch (error) {
        console.error("Error saving storage:", error);
    }
}

export async function setResponsible(leadId: LeadId, responsibleId: ResponsibleId): Promise<void> {
    const storage = await loadStorage();
    storage[String(leadId)] = responsibleId;
    await saveStorage(storage);
    console.log(`Set lead ${leadId} -> responsible ${responsibleId}`);
}

export async function getResponsible(leadId: LeadId): Promise<ResponsibleId | null> {
    const storage = await loadStorage();
    return storage[String(leadId)] ?? null;
}
