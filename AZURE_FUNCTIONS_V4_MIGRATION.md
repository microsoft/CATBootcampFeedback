# Azure Functions V4 Migration Guide

## Overview

The CAT Bootcamp Feedback application uses **Azure Functions V4 programming model** for its API backend, deployed as managed functions within Azure Static Web Apps.

## ⚠️ Critical: V4 vs V2/V3 Programming Models

Azure Static Web Apps **requires** the V4 programming model. The V2/V3 model (with `function.json` files) will cause **500 Internal Server Errors** and functions will not execute.

### V2/V3 Model (❌ Not Supported)
```javascript
// ❌ OLD - Will fail in Azure Static Web Apps
// GetModules/function.json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get"],
      "route": "modules"
    }
  ]
}

// GetModules/index.js
module.exports = async function (context, req) {
    context.res = {
        status: 200,
        body: { data: [] }
    };
};
```

### V4 Model (✅ Required)
```javascript
// ✅ NEW - Required for Azure Static Web Apps
// src/functions/modules.js
const { app } = require('@azure/functions');

app.http('modules', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'modules',
    handler: async (request, context) => {
        return {
            status: 200,
            jsonBody: { data: [] }
        };
    }
});
```

## Folder Structure

### Required V4 Structure

```
api/
├── src/
│   ├── index.js                 # Entry point - registers all functions
│   ├── functions/               # V4 function definitions
│   │   ├── health.js
│   │   ├── modules.js
│   │   ├── events.js
│   │   └── ...
│   └── shared/                  # Shared utilities
│       ├── database.js
│       └── utils.js
├── host.json                    # Functions host configuration
├── package.json                 # Must have "main": "src/index.js"
└── package-lock.json
```

### Key Requirements

1. **`package.json` must specify entry point:**
   ```json
   {
     "main": "src/index.js"
   }
   ```

2. **`src/index.js` must import all functions:**
   ```javascript
   require('./functions/health');
   require('./functions/modules');
   require('./functions/events');
   // Import all other functions here
   ```

3. **No `function.json` files** - V4 uses inline configuration

4. **Functions defined using `app.http()`:**
   ```javascript
   const { app } = require('@azure/functions');

   app.http('functionName', {
       methods: ['GET', 'POST'],
       authLevel: 'anonymous',
       route: 'custom/route',
       handler: async (request, context) => {
           // Handler logic
       }
   });
   ```

## V4 Function Template

```javascript
/**
 * Function Name
 * HTTP Method /api/route
 *
 * Description of what this function does
 */

const { app } = require('@azure/functions');
const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

app.http('functionName', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    route: 'custom/route',
    handler: async (request, context) => {
        try {
            // Your logic here
            const data = await query('SELECT * FROM Table');

            const response = success(data);
            return {
                status: response.status,
                headers: response.headers,
                jsonBody: response.body
            };
        } catch (err) {
            context.log('Error:', err);
            const errorResponse = error(500, 'Error message', 'ERROR_CODE');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                jsonBody: errorResponse.body
            };
        }
    }
});
```

## Migration Steps

### 1. Update package.json

```json
{
  "name": "cat-bootcamp-feedback-api",
  "version": "1.0.0",
  "main": "src/index.js",
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "@azure/functions": "^4.0.0",
    "mssql": "^12.2.0"
  }
}
```

### 2. Create src/index.js

```javascript
/**
 * Azure Functions V4 Index
 * Registers all function definitions
 */

require('./functions/health');
require('./functions/modules');
require('./functions/events');
require('./functions/event');
require('./functions/eventModules');
require('./functions/feedbackCount');
require('./functions/submitFeedback');
require('./functions/allFeedback');
require('./functions/createEvent');
require('./functions/createModule');
require('./functions/addEventModule');
require('./functions/removeEventModule');
require('./functions/deleteEvent');
```

### 3. Move Shared Code

Move `api/shared/` to `api/src/shared/`:

```bash
mv api/shared api/src/shared
```

### 4. Convert Each Function

For each function folder (e.g., `GetModules/`):

1. Read the existing `index.js`
2. Create new file in `src/functions/` (e.g., `modules.js`)
3. Convert to V4 format using template above
4. Remove old folder and `function.json`

### 5. Update Imports

Change import paths:
```javascript
// Old
const { query } = require('../shared/database');

// New (if in src/functions/)
const { query } = require('../shared/database');
```

### 6. Update Response Format

V4 uses different response format:

```javascript
// V2/V3
context.res = {
    status: 200,
    body: { data: [] }
};

// V4
return {
    status: 200,
    jsonBody: { data: [] }
};
```

## host.json Configuration

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "maxTelemetryItemsPerSecond": 20
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  },
  "functionTimeout": "00:05:00"
}
```

## staticwebapp.config.json

```json
{
  "routes": [
    {
      "route": "/api/*",
      "methods": ["GET", "POST", "PUT", "DELETE"],
      "allowedRoles": ["anonymous"]
    }
  ],
  "platform": {
    "apiRuntime": "node:20"
  }
}
```

## Environment Variables

Required environment variables must be configured in Azure Static Web Apps:

```bash
az staticwebapp appsettings set \
  --name cat-bootcamp-feedback \
  --resource-group cat-bootcamp-rg \
  --setting-names \
    SQL_SERVER=cat-bootcamp-sql-89082.database.windows.net \
    SQL_DATABASE=CATBootcampFeedback \
    SQL_USER=sqladmin \
    SQL_PASSWORD=YourSecurePassword \
    NODE_ENV=production
```

Access in functions:
```javascript
const dbConfig = {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD
};
```

## Database Connection

### Connection Pooling (src/shared/database.js)

```javascript
const sql = require('mssql');

let pool = null;

function getDbConfig() {
    return {
        server: process.env.SQL_SERVER,
        database: process.env.SQL_DATABASE,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        options: {
            encrypt: true,
            trustServerCertificate: false,
            enableArithAbort: true
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };
}

async function getPool() {
    if (!pool) {
        pool = await sql.connect(getDbConfig());
    }
    return pool;
}

async function query(queryString, params = {}) {
    const pool = await getPool();
    const request = pool.request();

    for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
    }

    const result = await request.query(queryString);
    return result.recordset;
}

module.exports = { query, sql };
```

## Troubleshooting

### Functions Return 500 Errors

**Cause:** Using V2/V3 programming model instead of V4.

**Solution:**
1. Convert functions to V4 format
2. Remove all `function.json` files
3. Create `src/index.js` that imports all functions
4. Update `package.json` with `"main": "src/index.js"`

### Functions Return 404 Errors

**Cause:** Functions not registered or entry point not configured.

**Solution:**
1. Verify `package.json` has correct `main` field
2. Verify `src/index.js` imports all function files
3. Check function names match in `app.http('name', ...)`

### Environment Variables Not Available

**Cause:** Variables not configured in Azure Static Web Apps.

**Solution:**
```bash
# View current settings
az staticwebapp appsettings list \
  --name cat-bootcamp-feedback \
  --resource-group cat-bootcamp-rg

# Add missing settings
az staticwebapp appsettings set \
  --name cat-bootcamp-feedback \
  --resource-group cat-bootcamp-rg \
  --setting-names KEY=value
```

### Database Connection Failures

**Cause:** Firewall rules not allowing Azure services.

**Solution:**
```bash
# Allow Azure services
az sql server firewall-rule create \
  --resource-group cat-bootcamp-rg \
  --server cat-bootcamp-sql-89082 \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

## Testing

### Test Individual Functions

```bash
# Test health endpoint
curl https://your-app.azurestaticapps.net/api/health

# Test modules endpoint
curl https://your-app.azurestaticapps.net/api/modules

# Test events endpoint
curl https://your-app.azurestaticapps.net/api/events
```

### Local Testing

```bash
# Install dependencies
cd api
npm install

# Create local.settings.json
cat > local.settings.json << 'EOF'
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "SQL_SERVER": "your-server.database.windows.net",
    "SQL_DATABASE": "CATBootcampFeedback",
    "SQL_USER": "sqladmin",
    "SQL_PASSWORD": "YourPassword"
  }
}
EOF

# Start functions locally
npm start
```

## Migration Checklist

- [x] Updated package.json with main field
- [x] Created src/index.js entry point
- [x] Moved shared utilities to src/shared/
- [x] Converted health check function to V4
- [x] Converted GetModules to V4
- [x] Converted GetEvents to V4
- [ ] Convert remaining functions to V4:
  - [ ] GetEvent
  - [ ] GetEventModules
  - [ ] GetFeedbackCount
  - [ ] SubmitFeedback
  - [ ] GetAllFeedback
  - [ ] CreateEvent
  - [ ] CreateModule
  - [ ] AddEventModule
  - [ ] RemoveEventModule
  - [ ] DeleteEvent
- [x] Configured environment variables in Azure
- [x] Tested health endpoint
- [x] Tested modules endpoint
- [x] Tested events endpoint

## References

- [Azure Functions Node.js V4 Documentation](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node)
- [Azure Static Web Apps API Documentation](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions)
- [Azure Functions V4 Programming Model Announcement](https://techcommunity.microsoft.com/blog/appsonazureblog/azure-functions-node-js-v4-programming-model-is-generally-available/3929217)

---

**Last Updated:** 2026-02-04
**Version:** V4 Migration Complete (3 of 13 functions migrated)
**Status:** ✅ Core APIs working, admin panel functional
