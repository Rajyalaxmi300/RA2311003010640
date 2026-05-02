const express = require('express');
const axios = require('axios');
const logger = require('../logging_middleware/logger');

const app = express();
app.use(express.json());
app.use(logger.middleware);

const AUTH_URL = 'http://20.207.122.201/evaluation-service/auth';
const BASE_URL = 'http://20.207.122.201/evaluation-service';

// ✅ GET TOKEN
async function getToken() {
    try {
        logger.info('Fetching fresh auth token...');

        const res = await axios.post(AUTH_URL, {
            email: "rm9396@srmist.edu.in",
            name: "rajyalaxmi mishra",
            rollNo: "ra2311003010640",
            accessCode: "QkbpxH",
            clientID: "f935da1b-bc66-4dab-9f58-a1311eb89319",
            clientSecret: "MsNzxdXQCPkweXEW"
        });

        // The API returns access_token, not token
        const token = res.data.access_token;

        if (!token) {
            throw new Error("❌ Token NOT found in response. Response data: " + JSON.stringify(res.data));
        }

        logger.info('Token fetched successfully');
        return token;

    } catch (error) {
        logger.error("Auth Error:", error.message);
        if (error.response) {
            logger.error(`Auth API Status: ${error.response.status} - Data: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
    }
}

// ✅ FETCH DATA
async function fetchData(token) {
    try {
        const headers = { Authorization: `Bearer ${token}` };

        logger.info('Fetching depots...');
        const depotsRes = await axios.get(`${BASE_URL}/depots`, { headers });
        logger.info(`Fetched ${depotsRes.data.depots.length} depots`);

        logger.info('Fetching vehicles...');
        const vehiclesRes = await axios.get(`${BASE_URL}/vehicles`, { headers });
        logger.info(`Fetched ${vehiclesRes.data.vehicles.length} vehicles`);

        return {
            depots: depotsRes.data.depots,
            vehicles: vehiclesRes.data.vehicles
        };

    } catch (error) {
        logger.error("Fetch Error:", error.message);
        if (error.response) {
            logger.error(`Fetch API Status: ${error.response.status} - Data: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
    }
}

// ✅ KNAPSACK
function knapsack(tasks, maxHours) {
    const n = tasks.length;
    const dp = Array(n + 1).fill(null).map(() => Array(maxHours + 1).fill(0));

    for (let i = 1; i <= n; i++) {
        for (let w = 0; w <= maxHours; w++) {
            if (tasks[i - 1].Duration <= w) {
                dp[i][w] = Math.max(
                    dp[i - 1][w],
                    tasks[i - 1].Impact + dp[i - 1][w - tasks[i - 1].Duration]
                );
            } else {
                dp[i][w] = dp[i - 1][w];
            }
        }
    }

    return dp[n][maxHours];
}

// ✅ ROUTE
app.get('/schedule', async (req, res) => {
    try {
        logger.info('Received GET /schedule');

        const token = await getToken();   // 🔥 KEY STEP
        const { depots, vehicles } = await fetchData(token);

        const result = depots.map(depot => {
            logger.info(`Depot ${depot.ID} | Budget: ${depot.MechanicHours}`);

            const maxImpact = knapsack(vehicles, depot.MechanicHours);

            return {
                depotId: depot.ID,
                maxImpact
            };
        });

        logger.info('Schedule computed successfully');
        res.json(result);

    } catch (error) {
        logger.error(`Final Error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// ✅ START SERVER
app.listen(3000, () => {
    logger.info('Vehicle Scheduler server running on port 3000');
});

// ✅ KEEP NODE RUNNING
process.stdin.resume();