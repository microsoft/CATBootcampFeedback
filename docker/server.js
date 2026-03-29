/**
 * Lightweight Express server that loads and serves Azure Functions v4 handlers.
 * Used for local Docker testing on ARM64 where func CLI doesn't work.
 */

const express = require('express');
const app = express();
const PORT = 80;

// Parse JSON bodies
app.use(express.json());
app.use(express.text({ type: 'application/json' }));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// Collect all registered handlers from Azure Functions
const handlers = new Map();

// Mock the Azure Functions app.http registration
const mockApp = {
    http: (name, config) => {
        handlers.set(name, config);
    }
};

// Patch require to return our mock
const originalRequire = module.constructor.prototype.require;
const Module = require('module');
const origResolve = Module._resolveFilename;

// Override @azure/functions to return our mock
Module._resolveFilename = function(request, parent, ...rest) {
    if (request === '@azure/functions') {
        return request;
    }
    return origResolve.call(this, request, parent, ...rest);
};

require.cache['@azure/functions'] = {
    id: '@azure/functions',
    filename: '@azure/functions',
    loaded: true,
    exports: { app: mockApp }
};

// Load all function files
const fs = require('fs');
const path = require('path');
const functionsDir = path.join(__dirname, 'src', 'functions');

for (const file of fs.readdirSync(functionsDir)) {
    if (file.endsWith('.js')) {
        try {
            require(path.join(functionsDir, file));
            console.log(`  Loaded: ${file}`);
        } catch (err) {
            console.error(`  Failed to load ${file}:`, err.message);
        }
    }
}

// Create an adapter: Azure Functions request → Express
function createAzureRequest(req) {
    const url = new URL(req.originalUrl, `http://${req.headers.host}`);
    return {
        method: req.method,
        url: url.toString(),
        headers: {
            get: (name) => req.headers[name.toLowerCase()],
            ...req.headers
        },
        params: req.params || {},
        query: Object.fromEntries(url.searchParams),
        text: async () => {
            if (typeof req.body === 'string') return req.body;
            if (req.body) return JSON.stringify(req.body);
            return '';
        },
        json: async () => req.body
    };
}

function createContext(name) {
    return {
        log: (...args) => console.log(`[${name}]`, ...args),
        error: (...args) => console.error(`[${name}]`, ...args),
        warn: (...args) => console.warn(`[${name}]`, ...args)
    };
}

// Sort handlers so literal routes register before parameterized ones.
// e.g., /api/users/me must come before /api/users/:userId
const sortedHandlers = [...handlers.entries()].sort(([, a], [, b]) => {
    const aRoute = a.route;
    const bRoute = b.route;
    // Count path parameters ({param} segments)
    const aParams = (aRoute.match(/\{[^}]+\}/g) || []).length;
    const bParams = (bRoute.match(/\{[^}]+\}/g) || []).length;
    // More segments = more specific = register first (e.g., users/me before users)
    const aSegments = aRoute.split('/').length;
    const bSegments = bRoute.split('/').length;
    // First: more segments first (longer paths are more specific)
    if (aSegments !== bSegments) return bSegments - aSegments;
    // Then: fewer params = more specific
    if (aParams !== bParams) return aParams - bParams;
    // Tie-break: alphabetical
    return aRoute.localeCompare(bRoute);
});

// Register Express routes for each Azure Function
for (const [name, config] of sortedHandlers) {
    // Convert Azure Functions {param} syntax to Express :param syntax
    const route = `/api/${config.route}`.replace(/\{(\w+)\}/g, ':$1');
    const methods = config.methods.map(m => m.toLowerCase());

    for (const method of methods) {
        app[method](route, async (req, res) => {
            try {
                const azReq = createAzureRequest(req);
                azReq.params = req.params;
                const context = createContext(name);
                const result = await config.handler(azReq, context);

                if (result) {
                    const status = result.status || 200;
                    const headers = result.headers || {};
                    for (const [key, value] of Object.entries(headers)) {
                        if (key.toLowerCase() !== 'content-type') {
                            res.setHeader(key, value);
                        }
                    }

                    if (result.jsonBody) {
                        res.status(status).json(result.jsonBody);
                    } else if (result.body) {
                        res.status(status).type('application/json').send(result.body);
                    } else {
                        res.status(status).end();
                    }
                } else {
                    res.status(204).end();
                }
            } catch (err) {
                console.error(`[${name}] Error:`, err);
                res.status(500).json({ success: false, message: 'Internal server error' });
            }
        });
        console.log(`  Route: ${method.toUpperCase()} ${route}`);
    }
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\nAPI server running on port ${PORT}`);
    console.log(`Registered ${handlers.size} function(s)\n`);
});
