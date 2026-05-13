import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAdminAccess, isAdminFlag, parseAdminUserIds } from "../services/adminAccess.js";

test("evaluateAdminAccess allows Bitrix administrators", () => {
    assert.equal(evaluateAdminAccess(25, true, new Set()).allowed, true);
});

test("evaluateAdminAccess allows override users", () => {
    assert.deepEqual(evaluateAdminAccess("25", false, parseAdminUserIds("25,29")), {
        allowed: true,
        userId: "25",
        isBitrixAdmin: false,
        isOverrideAdmin: true,
    });
});

test("evaluateAdminAccess denies normal users", () => {
    assert.equal(evaluateAdminAccess("99", false, parseAdminUserIds("25,29")).allowed, false);
});

test("isAdminFlag accepts Bitrix yes flag", () => {
    assert.equal(isAdminFlag("Y"), true);
    assert.equal(isAdminFlag("N"), false);
});
