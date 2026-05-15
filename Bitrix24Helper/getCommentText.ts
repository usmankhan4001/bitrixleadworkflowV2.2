import fs from "fs/promises";

import { getDataFilePath } from "../services/dataPaths.js";
import type { BitrixComment, OAuthStatus, OAuthTokenState } from "../types/bitrix.js";

const TOKEN_FILE_NAME = "b24_tokens.json";
const OAUTH_TOKEN_URL = "https://oauth.bitrix.info/oauth/token/";

type BitrixHttpErrorResponse = {
    error?: string;
    error_description?: string;
};

type BitrixTaskCommentListResponse = BitrixHttpErrorResponse & {
    result?: BitrixComment[];
};

function withOptionalString<T extends object>(
    target: T,
    key: "lastRefreshed" | "issuer",
    value: string | undefined
): T {
    if (typeof value === "undefined") {
        return target;
    }

    return {
        ...target,
        [key]: value,
    };
}

async function getTokenData(): Promise<OAuthTokenState> {
    try {
        const tokenData = await fs.readFile(await getDataFilePath(TOKEN_FILE_NAME), "utf-8");
        return JSON.parse(tokenData) as OAuthTokenState;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error reading token file:", errorMessage);
        throw error;
    }
}

async function saveTokenData(tokenData: OAuthTokenState): Promise<void> {
    try {
        await fs.writeFile(await getDataFilePath(TOKEN_FILE_NAME), JSON.stringify(tokenData, null, 2), "utf-8");
        console.log("Token data updated successfully.");
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error saving token file:", errorMessage);
        throw error;
    }
}

async function refreshAccessToken(tokenData: OAuthTokenState): Promise<OAuthTokenState> {
    const { refreshToken } = tokenData;

    if (!refreshToken) {
        throw new Error("Missing refreshToken in token data");
    }

    const clientId = process.env.BITRIX_CLIENT_ID;
    const clientSecret = process.env.BITRIX_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error("\nMISSING ENVIRONMENT VARIABLES");
        console.error("Required environment variables are not set.");
        console.error("\nPlease set the following in your Render environment:");
        console.error("- BITRIX_CLIENT_ID (your application code)");
        console.error("- BITRIX_CLIENT_SECRET (your application secret key)\n");
        throw new Error("Missing required environment variables: BITRIX_CLIENT_ID and BITRIX_CLIENT_SECRET");
    }

    const params = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
    });

    try {
        console.log("Refreshing access token...");
        const response = await fetch(`${OAUTH_TOKEN_URL}?${params.toString()}`);
        const data = await response.json() as {
            access_token?: string;
            refresh_token?: string;
            expires_in?: number;
            client_endpoint?: string;
            server_endpoint?: string;
            member_id?: string;
            domain?: string;
            scope?: string;
            status?: string;
            error?: string;
            error_description?: string;
        };

        if (data.error) {
            console.error("Token refresh error:", data.error, data.error_description);
            throw new Error(`Token refresh failed: ${data.error} - ${data.error_description}`);
        }

        if (!data.access_token || !data.refresh_token || !data.expires_in) {
            throw new Error("Token refresh response is missing required fields");
        }

    const normalizedStatus = (data.status ?? tokenData.status) as OAuthStatus;

        const updatedTokenData = withOptionalString({
            ...tokenData,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in,
            clientEndpoint: data.client_endpoint || tokenData.clientEndpoint,
            serverEndpoint: data.server_endpoint || tokenData.serverEndpoint,
            memberId: data.member_id || tokenData.memberId,
            domain: data.domain || tokenData.domain,
            scope: data.scope || tokenData.scope,
            status: normalizedStatus,
            expires: Math.floor(Date.now() / 1000) + data.expires_in,
            applicationToken: tokenData.applicationToken,
            userId: tokenData.userId,
        }, "lastRefreshed", new Date().toISOString());

        await saveTokenData(updatedTokenData);

        console.log("Token refreshed successfully");
        return updatedTokenData;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error refreshing token:", errorMessage);
        throw error;
    }
}

async function makeBitrixRequest(
    url: string,
    tokenData: OAuthTokenState,
    retryCount = 0
): Promise<BitrixTaskCommentListResponse> {
    try {
        const response = await fetch(url);
        const data = await response.json() as BitrixTaskCommentListResponse;

        if (data.error === "expired_token") {
            if (retryCount >= 1) {
                throw new Error("Token refresh failed after retry");
            }

            console.log("Access token expired. Refreshing...");
            const newTokenData = await refreshAccessToken(tokenData);

            const newUrl = url.replace(/auth=[^&]+/, `auth=${newTokenData.accessToken}`);
            return makeBitrixRequest(newUrl, newTokenData, retryCount + 1);
        }

        if (data.error) {
            console.error("Bitrix24 API Error:", data.error, data.error_description);
            throw new Error(`API Error: ${data.error} - ${data.error_description}`);
        }

        return data;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error making Bitrix request:", errorMessage);
        throw error;
    }
}

export default async function getCommentText(taskId: number, commentId: number): Promise<string | null> {
    const numericTaskId = Number(taskId);
    const numericCommentId = Number(commentId);

    if (Number.isNaN(numericTaskId) || Number.isNaN(numericCommentId)) {
        console.error("Invalid Task ID or Comment ID provided.", { taskId, commentId });
        return null;
    }

    try {
        const tokenData = await getTokenData();
        const url = `${tokenData.clientEndpoint}task.commentitem.getlist.json?auth=${tokenData.accessToken}&TASKID=${numericTaskId}`;

        const data = await makeBitrixRequest(url, tokenData);
        const comments = data.result;

        if (comments && Array.isArray(comments)) {
            const commentDetails = comments.find((comment) => parseInt(comment.ID, 10) === numericCommentId);

            if (commentDetails) {
                return commentDetails.POST_MESSAGE ?? null;
            }

            console.warn(`Comment ${numericCommentId} not found in task ${numericTaskId}.`);
            return null;
        }

        console.warn(`No comments found for task ${numericTaskId}.`);
        return null;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error calling task.commentitem.getlist: ${errorMessage}`);
        console.error("Full error:", error);
        return null;
    }
}

export { refreshAccessToken, getTokenData, saveTokenData, makeBitrixRequest };
