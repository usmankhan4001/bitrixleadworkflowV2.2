import assert from "node:assert/strict";
import test from "node:test";

import { resolveOverdueEscalation } from "../services/overdueEscalation.js";

test("resolveOverdueEscalation reassigns when a completed salesperson is available", () => {
    assert.deepEqual(resolveOverdueEscalation({
        department: "Sales Executives",
        taskCountForLead: 1,
        nextCompletedUser: 29,
        workflowManagerId: "1",
    }), {
        kind: "reassign-sales",
        assignedUserId: 29,
    });
});

test("resolveOverdueEscalation escalates when the lead already has two tasks", () => {
    assert.deepEqual(resolveOverdueEscalation({
        department: "Sales Executives",
        taskCountForLead: 2,
        nextCompletedUser: 29,
        workflowManagerId: "1",
    }), {
        kind: "workflow-manager",
        assignedUserId: "1",
    });
});

test("resolveOverdueEscalation escalates when no salesperson is available", () => {
    assert.deepEqual(resolveOverdueEscalation({
        department: null,
        taskCountForLead: 0,
        nextCompletedUser: null,
        workflowManagerId: "1",
    }), {
        kind: "workflow-manager",
        assignedUserId: "1",
    });
});
