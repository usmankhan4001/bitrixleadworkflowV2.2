import fsextra from "fs-extra";
import path from "path";
import { B24OAuth } from "@bitrix24/b24jssdk";

import type { OAuthStatus, OAuthTokenExchangeResponse, OAuthTokenState } from "../types/bitrix.js";

const PORT = process.env.PORT || 3000;
const DEFAULT_DATA_DIR = "/mnt/data";
const FALLBACK_DATA_DIR = path.join(process.cwd(), "data");
const TOKEN_FILE_NAME = "b24_tokens.json";

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

function getConfiguredDataDir(): string {
    return process.env.BITRIX_DATA_DIR || DEFAULT_DATA_DIR;
}

async function getWritableDataDir(): Promise<string> {
    const candidates = [getConfiguredDataDir(), FALLBACK_DATA_DIR];

    for (const candidate of candidates) {
        try {
            await fsextra.ensureDir(candidate);
            return candidate;
        } catch {
            continue;
        }
    }

    throw new Error("Unable to create a writable data directory for Bitrix token storage.");
}

async function getTokenFilePath(): Promise<string> {
    return path.join(await getWritableDataDir(), TOKEN_FILE_NAME);
}

export function getRedirectUri(): string {
    return process.env.BITRIX_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
}

async function loadTokens(): Promise<OAuthTokenState | null> {
    const tokenFile = await getTokenFilePath();
    if (await fsextra.pathExists(tokenFile)) {
        return fsextra.readJson(tokenFile) as Promise<OAuthTokenState>;
    }

    return null;
}

async function saveTokens(tokens: OAuthTokenState): Promise<void> {
    const tokenFile = await getTokenFilePath();
    await fsextra.writeJson(tokenFile, tokens, { spaces: 2 });
}

function normalizeNumeric(value: string | number | undefined, fieldName: string): number {
    const raw = requireOAuthField(value, fieldName);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Bitrix OAuth response contains an invalid numeric value for ${fieldName}`);
    }

    return parsed;
}

function firstString(...values: Array<string | undefined>): string | undefined {
    return values.find((value) => typeof value === "string" && value.length > 0);
}

function buildOAuthTokenState(
    data: OAuthTokenExchangeResponse & Record<string, unknown>,
    existingTokens?: OAuthTokenState | null
): OAuthTokenState {
    const memberId = firstString(
        data.member_id,
        typeof data.MEMBER_ID === "string" ? data.MEMBER_ID : undefined,
        existingTokens?.memberId
    );
    const domain = firstString(
        data.domain,
        typeof data.DOMAIN === "string" ? data.DOMAIN : undefined,
        existingTokens?.domain
    );
    const clientEndpoint = firstString(
        data.client_endpoint,
        typeof data.CLIENT_ENDPOINT === "string" ? data.CLIENT_ENDPOINT : undefined,
        existingTokens?.clientEndpoint
    );
    const serverEndpoint = firstString(
        data.server_endpoint,
        typeof data.SERVER_ENDPOINT === "string" ? data.SERVER_ENDPOINT : undefined,
        existingTokens?.serverEndpoint
    );
    const accessToken = firstString(
        data.access_token,
        typeof data.AUTH_ID === "string" ? data.AUTH_ID : undefined,
        existingTokens?.accessToken
    );
    const refreshToken = firstString(
        data.refresh_token,
        typeof data.REFRESH_ID === "string" ? data.REFRESH_ID : undefined,
        existingTokens?.refreshToken
    );
    const applicationToken = firstString(
        data.application_token,
        typeof data.APP_SID === "string" ? data.APP_SID : undefined,
        existingTokens?.applicationToken,
        memberId
    );

    return {
        accessToken: requireOAuthField(accessToken, "access_token"),
        refreshToken: requireOAuthField(refreshToken, "refresh_token"),
        expiresIn: normalizeNumeric(
            data.expires_in
                ?? (typeof data.AUTH_EXPIRES === "string" ? data.AUTH_EXPIRES : undefined)
                ?? existingTokens?.expiresIn,
            "expires_in"
        ),
        clientEndpoint: requireOAuthField(clientEndpoint, "client_endpoint"),
        serverEndpoint: requireOAuthField(serverEndpoint, "server_endpoint"),
        memberId: requireOAuthField(memberId, "member_id"),
        userId: normalizeNumeric(
            data.user_id
                ?? (typeof data.USER_ID === "string" ? data.USER_ID : undefined)
                ?? existingTokens?.userId,
            "user_id"
        ),
        domain: requireOAuthField(domain, "domain"),
        applicationToken: requireOAuthField(applicationToken, "application_token"),
        expires: normalizeNumeric(
            data.expires
                ?? (typeof data.AUTH_EXPIRES === "string" ? data.AUTH_EXPIRES : undefined)
                ?? existingTokens?.expires,
            "expires"
        ),
        scope: requireOAuthField(
            firstString(
                data.scope,
                typeof data.SCOPE === "string" ? data.SCOPE : undefined,
                existingTokens?.scope
            ),
            "scope"
        ),
        status: normalizeOAuthStatus(data.status ?? existingTokens?.status),
    };
}

export function getAuthorizationUrl(): string {
    const oauthSecret = getOauthSecret();
    const redirectUri = getRedirectUri();
    const encodedRedirectUri = encodeURIComponent(redirectUri);
    return `https://pcicrm.bitrix24.com/oauth/authorize/?client_id=${oauthSecret.clientId}&response_type=code&redirect_uri=${encodedRedirectUri}`;
}

export async function handleOAuthRedirect(code: string): Promise<void> {
    const oauthSecret = getOauthSecret();
    const redirectUri = encodeURIComponent(getRedirectUri());
    const encodedCode = encodeURIComponent(code);
    const encodedClientId = encodeURIComponent(oauthSecret.clientId);
    const encodedClientSecret = encodeURIComponent(oauthSecret.clientSecret);
    const url = `https://oauth.bitrix.info/oauth/token/?grant_type=authorization_code&client_id=${encodedClientId}&client_secret=${encodedClientSecret}&redirect_uri=${redirectUri}&code=${encodedCode}`;

    const response = await fetch(url, { method: "POST" });
    const data = await response.json() as OAuthTokenExchangeResponse;

    if (!data.access_token) {
        console.error("Bitrix Token Exchange Error:", data);
        throw new Error(data.error_description || data.error || "Failed to get access token. Check the authorization code and client credentials.");
    }

    await saveTokens(buildOAuthTokenState(data));
}

export async function handleInstallationCallback(data: Record<string, unknown>): Promise<void> {
    const existingTokens = await loadTokens();
    const normalized = buildOAuthTokenState(data as OAuthTokenExchangeResponse & Record<string, unknown>, existingTokens);
    await saveTokens(normalized);
}

export async function initializeAuthorizedClient(): Promise<B24OAuth> {
    const oauthParams = await loadTokens();
    if (!oauthParams) {
        throw new Error("Bitrix OAuth token file was not found after authorization.");
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

export async function getAuthStatus() {
    const tokenFile = await getTokenFilePath();
    const tokenFileExists = await fsextra.pathExists(tokenFile);
    return {
        hasOAuthConfig: hasBitrixOAuthConfig(),
        redirectUri: getRedirectUri(),
        tokenFile,
        tokenFileExists,
        initialized: b24Instance !== null,
    };
}

export async function initB24(): Promise<B24OAuth | null> {
    if (b24Instance) {
        return b24Instance;
    }

    const oauthParams = await loadTokens();
    if (!oauthParams) {
        return null;
    }

    return initializeAuthorizedClient();
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
