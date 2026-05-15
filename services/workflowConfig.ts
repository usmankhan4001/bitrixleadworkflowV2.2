import fs from "fs-extra";

import type { EntityId, WorkflowAssignmentDepartment, WorkflowConfig, WorkflowConfigView, WorkflowStateRecord } from "../types/domain.js";
import { getDataFilePath } from "./dataPaths.js";

const WORKFLOW_CONFIG_FILE_NAME = "workflowConfig.json";
const SALES_INDEX_FILE_NAME = "sales_indices.json";

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
    teams: [
        {
            name: "Sales Executives",
            memberIds: [25, 29, 133],
        },
        {
            name: "Telly Sales",
            memberIds: [113, 115, 167, 203],
        },
    ],
    sourceRouting: {
        excludedSourceIds: ["UC_NNO79X"],
        routes: [
            {
                sourceIds: ["WEBFORM", "1|FACEBOOK"],
                department: "Telly Sales",
            },
        ],
        defaultDepartment: "Sales Executives",
    },
    deadlines: {
        sales: "1 hour",
        workflowManager: "1 hour",
    },
    workflowManagerId: process.env.WORKFLOW_MANAGER || "1",
};

export function normalizeEntityId(value: EntityId): EntityId {
    const stringValue = String(value).trim();
    return /^\d+$/.test(stringValue) ? Number(stringValue) : stringValue;
}

function normalizeStringList(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function validateWorkflowConfig(config: WorkflowConfig): WorkflowConfig {
    const normalizedTeams = config.teams.map((team) => ({
        name: team.name.trim(),
        memberIds: team.memberIds.map(normalizeEntityId),
    }));

    if (normalizedTeams.length === 0 || normalizedTeams.some((team) => !team.name || team.memberIds.length === 0)) {
        throw new Error("Each workflow team must have a name and at least one member.");
    }

    const teamNames = new Set(normalizedTeams.map((team) => team.name));
    if (teamNames.size !== normalizedTeams.length) {
        throw new Error("Workflow team names must be unique.");
    }

    if (!teamNames.has(config.sourceRouting.defaultDepartment)) {
        throw new Error("Default routing department must match a configured team.");
    }

    for (const route of config.sourceRouting.routes) {
        if (!teamNames.has(route.department)) {
            throw new Error(`Route department '${route.department}' must match a configured team.`);
        }

        if (normalizeStringList(route.sourceIds).length === 0) {
            throw new Error("Each source route must include at least one source ID.");
        }
    }

    if (!config.deadlines.sales.trim() || !config.deadlines.workflowManager.trim()) {
        throw new Error("Both sales and workflow manager deadlines are required.");
    }

    return {
        teams: normalizedTeams,
        sourceRouting: {
            excludedSourceIds: normalizeStringList(config.sourceRouting.excludedSourceIds),
            routes: config.sourceRouting.routes.map((route) => ({
                department: route.department,
                sourceIds: normalizeStringList(route.sourceIds),
            })),
            defaultDepartment: config.sourceRouting.defaultDepartment,
        },
        deadlines: {
            sales: config.deadlines.sales.trim(),
            workflowManager: config.deadlines.workflowManager.trim(),
        },
        workflowManagerId: normalizeEntityId(config.workflowManagerId),
    };
}

export function getTeam(config: WorkflowConfig, department: WorkflowAssignmentDepartment) {
    return config.teams.find((team) => team.name === department) ?? null;
}

export function getDepartmentByConfiguredUserId(config: WorkflowConfig, userId: EntityId): WorkflowAssignmentDepartment | null {
    const normalizedUserId = String(userId);
    return config.teams.find((team) => team.memberIds.some((memberId) => String(memberId) === normalizedUserId))?.name ?? null;
}

function createDefaultIndices(config: WorkflowConfig): WorkflowStateRecord<number> {
    return Object.fromEntries(config.teams.map((team) => [team.name, 0]));
}

export async function loadRoundRobinIndices(config: WorkflowConfig): Promise<WorkflowStateRecord<number>> {
    const salesIndexFile = await getDataFilePath(SALES_INDEX_FILE_NAME);
    if (await fs.pathExists(salesIndexFile)) {
        const storedIndices = await fs.readJson(salesIndexFile) as Partial<WorkflowStateRecord<number>>;
        const mergedIndices = createDefaultIndices(config);
        for (const [department, index] of Object.entries(storedIndices)) {
            mergedIndices[department] = index ?? 0;
        }
        return mergedIndices;
    }

    const defaultIndices = createDefaultIndices(config);
    await fs.outputJson(salesIndexFile, defaultIndices, { spaces: 2 });
    return defaultIndices;
}

export async function saveRoundRobinIndices(indices: WorkflowStateRecord<number>): Promise<void> {
    await fs.outputJson(await getDataFilePath(SALES_INDEX_FILE_NAME), indices, { spaces: 2 });
}

export async function loadWorkflowConfig(): Promise<WorkflowConfig> {
    const workflowConfigFile = await getDataFilePath(WORKFLOW_CONFIG_FILE_NAME);
    if (await fs.pathExists(workflowConfigFile)) {
        const storedConfig = await fs.readJson(workflowConfigFile) as WorkflowConfig;
        return validateWorkflowConfig({
            ...DEFAULT_WORKFLOW_CONFIG,
            ...storedConfig,
            sourceRouting: {
                ...DEFAULT_WORKFLOW_CONFIG.sourceRouting,
                ...storedConfig.sourceRouting,
            },
            deadlines: {
                ...DEFAULT_WORKFLOW_CONFIG.deadlines,
                ...storedConfig.deadlines,
            },
        });
    }

    const defaultConfig = validateWorkflowConfig(DEFAULT_WORKFLOW_CONFIG);
    await fs.outputJson(workflowConfigFile, defaultConfig, { spaces: 2 });
    return defaultConfig;
}

export async function saveWorkflowConfig(config: WorkflowConfig): Promise<WorkflowConfigView> {
    const validatedConfig = validateWorkflowConfig(config);
    await fs.outputJson(await getDataFilePath(WORKFLOW_CONFIG_FILE_NAME), validatedConfig, { spaces: 2 });

    const currentIndices = await loadRoundRobinIndices(validatedConfig);
    const nextIndices = Object.fromEntries(
        validatedConfig.teams.map((team) => [team.name, currentIndices[team.name] ?? 0])
    );
    await saveRoundRobinIndices(nextIndices);

    return {
        ...validatedConfig,
        roundRobinIndices: nextIndices,
    };
}

export async function loadWorkflowConfigView(): Promise<WorkflowConfigView> {
    const config = await loadWorkflowConfig();
    return {
        ...config,
        roundRobinIndices: await loadRoundRobinIndices(config),
    };
}
