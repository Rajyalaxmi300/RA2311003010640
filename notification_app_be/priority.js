const axios = require('axios');
const logger = require('../logging_middleware/logger');

// ─── Constants ────────────────────────────────────────────────────────────────
const AUTH_URL = 'http://20.207.122.201/evaluation-service/auth';
const BASE_URL = 'http://20.207.122.201/evaluation-service';

const AUTH_CREDENTIALS = {
    email: "rm9396@srmist.edu.in",
    name: "rajyalaxmi mishra",
    rollNo: "ra2311003010640",
    accessCode: "QkbpxH",
    clientID: "f935da1b-bc66-4dab-9f58-a1311eb89319",
    clientSecret: "MsNzxdXQCPkweXEW"
};

const TYPE_WEIGHT = {
    Placement: 3,
    Result: 2,
    Event: 1
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // 2 seconds between retries
const REQUEST_TIMEOUT_MS = 10000; // 10 second timeout per request

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Waits for a given number of milliseconds
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Makes an Axios request with automatic retry on network errors
async function axiosWithRetry(config, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios({ ...config, timeout: REQUEST_TIMEOUT_MS });
            return response;
        } catch (error) {
            const isNetworkError = !error.response; // ECONNRESET, ETIMEDOUT, etc.
            const isLastAttempt = attempt === retries;

            if (isNetworkError && !isLastAttempt) {
                logger.warn(`Retry attempt ${attempt} of ${retries - 1} after network error: ${error.message}`);
                await sleep(RETRY_DELAY_MS);
            } else {
                throw error; // Rethrow on HTTP errors or final retry failure
            }
        }
    }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getToken() {
    logger.info('Fetching fresh auth token...');
    const res = await axiosWithRetry({
        method: 'POST',
        url: AUTH_URL,
        data: AUTH_CREDENTIALS
    });

    const token = res.data.access_token;
    if (!token) {
        throw new Error(`Token not found in auth response. Got: ${JSON.stringify(res.data)}`);
    }

    logger.info('Auth token fetched successfully.');
    return token;
}

// ─── Main Logic ──────────────────────────────────────────────────────────────

async function getTop10() {
    try {
        logger.info('Starting Priority Inbox - fetching notifications...');

        const token = await getToken();

        logger.info('Fetching notifications...');
        const res = await axiosWithRetry({
            method: 'GET',
            url: `${BASE_URL}/notifications`,
            headers: { Authorization: `Bearer ${token}` }
        });

        const notifications = res.data.notifications;
        logger.info(`Fetched ${notifications.length} total notifications`);

        const sorted = notifications.sort((a, b) => {
            const scoreA = TYPE_WEIGHT[a.Type] * 1e12 + new Date(a.Timestamp).getTime();
            const scoreB = TYPE_WEIGHT[b.Type] * 1e12 + new Date(b.Timestamp).getTime();
            return scoreB - scoreA;
        });

        const top10 = sorted.slice(0, 10);

        logger.info('Top 10 priority notifications selected successfully');
        top10.forEach((notif, i) => {
            logger.info(`#${i + 1} | Type: ${notif.Type} | Message: ${notif.Message} | Timestamp: ${notif.Timestamp}`);
        });

    } catch (error) {
        if (error.response) {
            // HTTP error from the server (4xx, 5xx)
            logger.error(`API Error: HTTP ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.code) {
            // Network-level error (ECONNRESET, ETIMEDOUT, etc.) after all retries exhausted
            logger.error(`Network Error [${error.code}]: ${error.message}. All ${MAX_RETRIES} retry attempts failed.`);
        } else {
            // Generic error (e.g., token not found)
            logger.error(`Error: ${error.message}`);
        }
        process.exitCode = 1;
    }
}

getTop10();