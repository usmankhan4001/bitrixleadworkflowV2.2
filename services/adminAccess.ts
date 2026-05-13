import type { Request } from "express";

import { callBitrixGetMethod } from "../Bitrix24Helper/bitrixApi.js";
import type { EntityId } from "../types/domain.js";

export type BitrixCurrentUser = {
    ID?: EntityId;
    ADMIN?: boolean | "Y" | "N";
    NAME?: string;
    LAST_NAME?: string;
};

export type AdminAccessResult = {
    allowed: boolean;
    userId: string | null;
    isBitrixAdmin: boolean;
    isOverrideAdmin: boolean;
};

export function parseAdminUserIds(rawValue = ""): Set<string> {
    return new Set(rawValue.split(",").map((value) => value.trim()).filter(Boolean));
}

export function evaluateAdminAccess(
    userId: EntityId | null | undefined,
    isBitrixAdmin: boolean,
    adminOverrideIds: Set<string>
): AdminAccessResult {
    const normalizedUserId = typeof userId === "undefined" || userId === null ? null : String(userId);
    const isOverrideAdmin = normalizedUserId ? adminOverrideIds.has(normalizedUserId) : false;

    return {
        allowed: isBitrixAdmin || isOverrideAdmin,
        userId: normalizedUserId,
        isBitrixAdmin,
        isOverrideAdmin,
    };
}

export function isAdminFlag(value: BitrixCurrentUser["ADMIN"]): boolean {
    return value === true || value === "Y";
}

export function getRequestUserId(req: Request): EntityId | null {
    const headerUserId = req.header("x-bitrix-user-id");
    if (headerUserId) {
        return headerUserId;
    }

    const queryUserId = req.query.userId ?? req.query.USER_ID;
    if (typeof queryUserId === "string") {
        return queryUserId;
    }

    return null;
}

export async function getBitrixCurrentUser(): Promise<BitrixCurrentUser | null> {
    try {
        return await callBitrixGetMethod<BitrixCurrentUser>("user.current", undefined, "Failed to fetch current Bitrix user");
    } catch (error) {
        console.error("Unable to resolve Bitrix current user:", error);
        return null;
    }
}
