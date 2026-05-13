import fsextra from "fs-extra";
import path from "path";
import { B24OAuth } from "@bitrix24/b24jssdk";

const TOKEN_FILE = path.join("/mnt/data", "b24_tokens.json");
const PORT = process.env.PORT || 3000;

type OAuthTokenState = Record<string, unknown>;

let b24Instance: B24OAuth | null = null;

const oauthSecret = {
    clientId: process.env.BITRIX_CLIENT_ID,
    clientSecret: process.env.BITRIX_CLIENT_SECRET,
};

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
    const redirectUri = getRedirectUri();
    const encodedRedirectUri = encodeURIComponent(redirectUri);
    return `https://pcicrm.bitrix24.com/oauth/authorize/?client_id=${oauthSecret.clientId}&response_type=code&redirect_uri=${encodedRedirectUri}`;
}

export async function handleOAuthRedirect(code: string): Promise<void> {
    const redirectUri = getRedirectUri();
    const correctDomain = "pcicrm.bitrix24.com";

    const url = `https://oauth.bitrix.info/oauth/token/?grant_type=authorization_code&client_id=${oauthSecret.clientId}&client_secret=${oauthSecret.clientSecret}&redirect_uri=${redirectUri}&code=${code}`;

    const response = await fetch(url, { method: "POST" });
    const data = await response.json() as Record<string, unknown>;

    if (!data.access_token) {
        console.error("Bitrix Token Exchange Error:", data);
        throw new Error("Failed to get access token. Check the authorization code and client credentials.");
    }

    const correctedData: OAuthTokenState = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        clientEndpoint: data.client_endpoint,
        serverEndpoint: data.server_endpoint,
        memberId: data.member_id,
        userId: data.user_id,
        domain: correctDomain || data.domain,
        applicationToken: data.application_token || "PLACEHOLDER_FOR_SDK_INIT",
        expires: data.expires,
        scope: data.scope,
        status: data.status,
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

    const oauth = new B24OAuth(oauthParams as any, oauthSecret as any);

    oauth.setCallbackRefreshAuth(async ({ b24OAuthParams }: any) => {
        await saveTokens(b24OAuthParams as OAuthTokenState);
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
