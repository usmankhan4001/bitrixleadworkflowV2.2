import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_WORKFLOW_CONFIG, validateWorkflowConfig } from "../services/workflowConfig.js";

test("validateWorkflowConfig accepts default config", () => {
    assert.deepEqual(validateWorkflowConfig(DEFAULT_WORKFLOW_CONFIG), {
        ...DEFAULT_WORKFLOW_CONFIG,
        workflowManagerId: 1,
    });
});

test("validateWorkflowConfig rejects empty teams", () => {
    assert.throws(() => validateWorkflowConfig({
        ...DEFAULT_WORKFLOW_CONFIG,
        teams: [],
    }), /team/i);
});

test("validateWorkflowConfig rejects routes pointing at unknown teams", () => {
    assert.throws(() => validateWorkflowConfig({
        ...DEFAULT_WORKFLOW_CONFIG,
        sourceRouting: {
            ...DEFAULT_WORKFLOW_CONFIG.sourceRouting,
            routes: [
                {
                    sourceIds: ["WEBFORM"],
                    department: "Unknown Team",
                },
            ],
        },
    }), /Route department/i);
});

test("validateWorkflowConfig rejects teams without member IDs", () => {
    assert.throws(() => validateWorkflowConfig({
        ...DEFAULT_WORKFLOW_CONFIG,
        teams: [
            {
                name: "Sales Executives",
                memberIds: [],
            },
        ],
    }), /at least one member/i);
});
