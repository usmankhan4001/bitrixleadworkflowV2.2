import type { B24OAuth } from "@bitrix24/b24jssdk";

import { b24 } from "../Bitrix24AuthUtils/Bitrix24AuthUtils.js";
import type { BitrixApiError } from "../types/bitrix.js";

type BitrixResponseData<TResult> = BitrixApiError & {
    result?: TResult;
};

type BitrixListResponseData<TResult> = BitrixApiError & {
    result?: TResult[];
};

function getClient(): B24OAuth {
    return b24.instance;
}

async function callBitrixMethod(
    method: string,
    params?: Record<string, unknown>
): Promise<unknown> {
    const response = await getClient().callMethod(method, params);
    return response.getData();
}

export function assertBitrixSuccess<TResult>(
    payload: BitrixResponseData<TResult> | BitrixListResponseData<TResult>,
    context: string
): void {
    if (payload.error) {
        throw new Error(`${context}: ${payload.error_description ?? payload.error}`);
    }
}

export function getBitrixResult<TResult>(
    payload: BitrixResponseData<TResult>,
    context: string
): TResult {
    assertBitrixSuccess(payload, context);

    if (typeof payload.result === "undefined") {
        throw new Error(`${context}: missing result payload`);
    }

    return payload.result;
}

export function getBitrixListResult<TResult>(
    payload: BitrixListResponseData<TResult>,
    context: string
): TResult[] {
    assertBitrixSuccess(payload, context);
    return payload.result ?? [];
}

export async function callBitrixGetMethod<TResult>(
    method: string,
    params: Record<string, unknown> | undefined,
    context: string
): Promise<TResult> {
    const payload = await callBitrixMethod(method, params) as BitrixResponseData<TResult>;
    return getBitrixResult(payload, context);
}

export async function callBitrixListMethod<TResult>(
    method: string,
    params: Record<string, unknown> | undefined,
    context: string
): Promise<TResult[]> {
    const payload = await callBitrixMethod(method, params) as BitrixListResponseData<TResult>;
    return getBitrixListResult(payload, context);
}
