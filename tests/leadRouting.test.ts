import assert from "node:assert/strict";
import test from "node:test";

import { resolveLeadRouting } from "../services/leadRouting.js";

test("resolveLeadRouting skips excluded source", () => {
    assert.deepEqual(resolveLeadRouting("UC_NNO79X"), { kind: "skip" });
});

test("resolveLeadRouting routes telly sales sources", () => {
    assert.deepEqual(resolveLeadRouting("WEBFORM"), {
        kind: "assign",
        department: "Telly Sales",
    });
    assert.deepEqual(resolveLeadRouting("1|FACEBOOK"), {
        kind: "assign",
        department: "Telly Sales",
    });
});

test("resolveLeadRouting defaults to sales executives", () => {
    assert.deepEqual(resolveLeadRouting("SOMETHING_ELSE"), {
        kind: "assign",
        department: "Sales Executives",
    });
});
