import fsextra from "fs-extra";
import path from "path";
import { B24OAuth } from "@bitrix24/b24jssdk";

import type { OAuthStatus, OAuthTokenExchangeResponse, OAuthTokenState } from "../types/bitrix.js";

const TOKEN_FILE = path.join("/mnt/data", "b24_tokens.json");
const PORT = process.env.PORT || 3000;

let b24Instance: B24OAuth | null = null;

function requireEnv(value: string | undefined, variableName: string): string {
    if (!value) {
        throw new Error(`Missing required environment variable: ${variableName}`);
    }

    return value;
}

function getOauthSecret(): { clientId: string; clientSecret: string } {
    return {
        clientId: requireEnv(process.env.BITRIX_CLIENT_ID, "BITRIX_CLIENT_ID"),
        clientSecret: requireEnv(process.env.BITRIX_CLIENT_SECRET, "BITRIX_CLIENT_SECRET"),
    };
}

export function hasBitrixOAuthConfig(): boolean {
    return Boolean(process.env.BITRIX_CLIENT_ID && process.env.BITRIX_CLIENT_SECRET);
}

function requireOAuthField<T>(value: T | undefined, fieldName: string): T {
    if (typeof value === "undefined") {
        throw new Error(`Bitrix OAuth response is missing ${fieldName}`);
    }

    return value;
}

function normalizeOAuthStatus(value: OAuthStatus | undefined): OAuthStatus {
    return value ?? "L";
}

export function getRedirectUri(): string {
    return process.env.BITRIX_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
}

async function loadTokens(): Promise<OAuthTokenState | null> {
    if (await fsextra.pathExists(TOKEN_FILE)) {
        return fsextra.readJson(TOKEN_FILE) as Promise<OAuthTokenState>;
    }

    return null;
}

async function saveTokens(tokens: OAuthTokenState): Promise<void> {
    await fsextra.writeJson(TOKEN_FILE, tokens, { spaces: 2 });
}

export function getAuthorizationUrl(): string {
    const oauthSecret = getOauthSecret();
    const redirectUri = getRedirectUri();
    const encodedRedirectUri = encodeURIComponent(redirectUri);
    return `https://pcicrm.bitrix24.com/oauth/authorize/?client_id=${oauthSecret.clientId}&response_type=code&redirect_uri=${encodedRedirectUri}`;
}

export async function handleOAuthRedirect(code: string): Promise<void> {
    const oauthSecret = getOauthSecret();
    const redirectUri = getRedirectUri();
    const correctDomain = "pcicrm.bitrix24.com";

    const url = `https://oauth.bitrix.info/oauth/token/?grant_type=authorization_code&client_id=${oauthSecret.clientId}&client_secret=${oauthSecret.clientSecret}&redirect_uri=${redirectUri}&code=${code}`;

    const response = await fetch(url, { method: "POST" });
    const data = await response.json() as OAuthTokenExchangeResponse;

    if (!data.access_token) {
        console.error("Bitrix Token Exchange Error:", data);
        throw new Error("Failed to get access token. Check the authorization code and client credentials.");
    }

    const correctedData: OAuthTokenState = {
        accessToken: data.access_token,
        refreshToken: requireOAuthField(data.refresh_token, "refresh_token"),
        expiresIn: requireOAuthField(data.expires_in, "expires_in"),
        clientEndpoint: requireOAuthField(data.client_endpoint, "client_endpoint"),
        serverEndpoint: requireOAuthField(data.server_endpoint, "server_endpoint"),
        memberId: requireOAuthField(data.member_id, "member_id"),
        userId: Number(requireOAuthField(data.user_id, "user_id")),
        domain: correctDomain || requireOAuthField(data.domain, "domain"),
        applicationToken: data.application_token || "PLACEHOLDER_FOR_SDK_INIT",
        expires: requireOAuthField(data.expires, "expires"),
        scope: requireOAuthField(data.scope, "scope"),
        status: normalizeOAuthStatus(data.status),
    };

    await saveTokens(correctedData);
}

export async function initB24(): Promise<B24OAuth | null> {
    if (b24Instance) {
        return b24Instance;
    }

    const oauthParams = await loadTokens();
    if (!oauthParams) {
        return null;
    }

    const oauthSecret = getOauthSecret();
    const oauth = new B24OAuth(oauthParams, oauthSecret);

    oauth.setCallbackRefreshAuth(async ({ b24OAuthParams }: { b24OAuthParams: OAuthTokenState }) => {
        await saveTokens(b24OAuthParams);
        console.log("Tokens refreshed and saved!");
    });

    b24Instance = oauth;
    return b24Instance;
}

export const b24 = {
    async init(): Promise<B24OAuth | null> {
        b24Instance = await initB24();
        return b24Instance;
    },
    get instance(): B24OAuth {
        if (!b24Instance) {
            throw new Error("B24 instance not initialized. Call b24.init() first.");
        }

        return b24Instance;
    },
};
