import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN_PATH = '/mnt/data/b24_tokens.json';
const OAUTH_TOKEN_URL = 'https://oauth.bitrix.info/oauth/token/';

/**
 * Reads the Bitrix24 tokens from the JSON file
 * @returns {Promise<object>} The token data
 */
async function getTokenData() {
    try {
        const tokenData = await fs.readFile(TOKEN_PATH, 'utf-8');
        return JSON.parse(tokenData);
    } catch (error) {
        console.error('Error reading token file:', error.message);
        throw error;
    }
}

/**
 * Saves updated token data to the JSON file
 * @param {object} tokenData The token data to save
 */
async function saveTokenData(tokenData) {
    try {
        await fs.writeFile(TOKEN_PATH, JSON.stringify(tokenData, null, 2), 'utf-8');
        console.log('Token data updated successfully.');
    } catch (error) {
        console.error('Error saving token file:', error.message);
        throw error;
    }
}

/**
 * Refreshes the access token using the refresh token
 * @param {object} tokenData Current token data containing refreshToken
 * @returns {Promise<object>} New token data
 */
async function refreshAccessToken(tokenData) {
    const { refreshToken } = tokenData;

    if (!refreshToken) {
        throw new Error('Missing refreshToken in token data');
    }

    // Get credentials from environment variables
    const clientId = process.env.BITRIX_CLIENT_ID;
    const clientSecret = process.env.BITRIX_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error('\n⚠️  MISSING ENVIRONMENT VARIABLES ⚠️');
        console.error('Required environment variables are not set.');
        console.error('\nPlease set the following in your Render environment:');
        console.error('- BITRIX_CLIENT_ID (your application code)');
        console.error('- BITRIX_CLIENT_SECRET (your application secret key)\n');
        throw new Error('Missing required environment variables: BITRIX_CLIENT_ID and BITRIX_CLIENT_SECRET');
    }

    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken
    });

    try {
        console.log('Refreshing access token...');
        const response = await fetch(`${OAUTH_TOKEN_URL}?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            console.error('Token refresh error:', data.error, data.error_description);
            throw new Error(`Token refresh failed: ${data.error} - ${data.error_description}`);
        }

        // Construct updated token data, preserving existing fields
        const updatedTokenData = {
            ...tokenData,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in,
            clientEndpoint: data.client_endpoint || tokenData.clientEndpoint,
            serverEndpoint: data.server_endpoint || tokenData.serverEndpoint,
            memberId: data.member_id || tokenData.memberId,
            domain: data.domain || tokenData.domain,
            scope: data.scope || tokenData.scope,
            status: data.status || tokenData.status,
            expires: Math.floor(Date.now() / 1000) + data.expires_in,
            lastRefreshed: new Date().toISOString()
        };

        // Save the new tokens
        await saveTokenData(updatedTokenData);

        console.log('✅ Token refreshed successfully');
        return updatedTokenData;
    } catch (error) {
        console.error('Error refreshing token:', error.message);
        throw error;
    }
}

/**
 * Makes a request to Bitrix24 API with automatic token refresh on expiration
 * @param {string} url The API endpoint URL
 * @param {object} tokenData Current token data
 * @param {number} retryCount Internal retry counter (don't set manually)
 * @returns {Promise<object>} API response data
 */
async function makeBitrixRequest(url, tokenData, retryCount = 0) {
    try {
        const response = await fetch(url);
        const data = await response.json();

        // Check if token expired
        if (data.error === 'expired_token') {
            if (retryCount >= 1) {
                throw new Error('Token refresh failed after retry');
            }

            console.log('Access token expired. Refreshing...');
            const newTokenData = await refreshAccessToken(tokenData);
            
            // Retry the request with new token
            const newUrl = url.replace(/auth=[^&]+/, `auth=${newTokenData.accessToken}`);
            return await makeBitrixRequest(newUrl, newTokenData, retryCount + 1);
        }

        if (data.error) {
            console.error('Bitrix24 API Error:', data.error, data.error_description);
            throw new Error(`API Error: ${data.error} - ${data.error_description}`);
        }

        return data;
    } catch (error) {
        console.error('Error making Bitrix request:', error.message);
        throw error;
    }
}

/**
 * Retrieves a specific task comment by its Task ID and Comment ID.
 * 
 * @param {number} taskId The ID of the task the comment belongs to.
 * @param {number} commentId The ID of the comment to retrieve.
 * @returns {Promise<object | null>} The comment object or null on error.
 */
export default async function getCommentText(taskId, commentId) {
    const numericTaskId = parseInt(taskId, 10);
    const numericCommentId = parseInt(commentId, 10);

    if (isNaN(numericTaskId) || isNaN(numericCommentId)) {
        console.error('Invalid Task ID or Comment ID provided.', { taskId, commentId });
        return null;
    }

    try {
        const tokenData = await getTokenData();
        const url = `${tokenData.clientEndpoint}task.commentitem.getlist.json?auth=${tokenData.accessToken}&TASKID=${numericTaskId}`;

        const data = await makeBitrixRequest(url, tokenData);
        const comments = data?.result;

        if (comments && Array.isArray(comments)) {
            const commentDetails = comments.find(comment => parseInt(comment.ID) === numericCommentId);

            if (commentDetails) {
                return commentDetails.POST_MESSAGE;
            } else {
                console.warn(`Comment ${numericCommentId} not found in task ${numericTaskId}.`);
                return null;
            }
        } else {
            console.warn(`No comments found for task ${numericTaskId}.`);
            return null;
        }

    } catch (error) {
        console.error(`Error calling task.commentitem.getlist: ${error.message || error}`);
        console.error('Full error:', error);
        return null;
    }
}

// Export helper functions for use in other modules
export { refreshAccessToken, getTokenData, saveTokenData, makeBitrixRequest };