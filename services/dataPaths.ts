import fs from "fs-extra";
import path from "path";

const DEFAULT_DATA_DIR = "/mnt/data";
const FALLBACK_DATA_DIR = path.join(process.cwd(), "data");

export function getConfiguredDataDir(): string {
    return process.env.BITRIX_DATA_DIR || DEFAULT_DATA_DIR;
}

export async function getWritableDataDir(): Promise<string> {
    const candidates = [getConfiguredDataDir(), FALLBACK_DATA_DIR];

    for (const candidate of candidates) {
        try {
            await fs.ensureDir(candidate);
            return candidate;
        } catch {
            continue;
        }
    }

    throw new Error("Unable to create a writable data directory for workflow storage.");
}

export async function getDataFilePath(fileName: string): Promise<string> {
    return path.join(await getWritableDataDir(), fileName);
}
