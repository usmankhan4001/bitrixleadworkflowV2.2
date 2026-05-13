import type { EntityId } from "./domain.js";

export type OAuthStatus = "F" | "D" | "T" | "P" | "L" | "S";

export type BitrixApiError = {
    error?: string;
    error_description?: string;
};

export type OAuthTokenState = {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    clientEndpoint: string;
    serverEndpoint: string;
    memberId: string;
    userId: number;
    domain: string;
    applicationToken: string;
    expires: number;
    scope: string;
    status: OAuthStatus;
    lastRefreshed?: string | undefined;
};

export type OAuthTokenExchangeResponse = {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    client_endpoint?: string;
    server_endpoint?: string;
    member_id?: string;
    user_id?: string | number;
    domain?: string;
    application_token?: string;
    expires?: number;
    scope?: string;
    status?: OAuthStatus;
    error?: string;
    error_description?: string;
};

export type BitrixLead = {
    ID?: EntityId;
    TITLE?: string;
    SOURCE_ID?: string;
    ASSIGNED_BY_ID?: EntityId;
    MODIFY_BY_ID?: EntityId;
    STATUS_ID?: string;
};

export type BitrixUser = {
    ID?: EntityId;
    NAME?: string;
    LAST_NAME?: string;
};

export type BitrixTask = {
    id: EntityId;
    title?: string;
    responsibleId?: EntityId;
    deadline?: string;
    ufCrmTask?: string | string[];
};

export type BitrixTaskListResult = {
    tasks: BitrixTask[];
};

export type BitrixTaskAddResult = {
    task?: {
        id?: EntityId;
    };
};

export type BitrixComment = {
    ID: string;
    POST_MESSAGE?: string;
};
