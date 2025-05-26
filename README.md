# SAP Integration Suite Dashboard Backend

This is the backend service for the SAP Integration Suite Dashboard, which provides comprehensive metrics and insights for SAP Integration Suite tenants.

## Features

- OAuth authentication with SAP Integration Suite
- Data fetching from SAP Integration Suite APIs (design-time and runtime)
- Data processing and transformation to extract detailed metrics
- PostgreSQL database storage according to a comprehensive schema
- RESTful APIs for the frontend dashboard and chat interface
- Scheduled jobs for periodic data updates
- NLP-based chat interface for querying integration flow data

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- SAP Integration Suite tenant with OAuth client credentials

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd sap_dashboard_backend
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following configuration:

```
# SAP Integration Suite Configuration
SAP_CLIENT_ID=your_client_id
SAP_CLIENT_SECRET=your_client_secret
SAP_TOKEN_URL=https://your-tenant.authentication.sap.hana.ondemand.com/oauth/token
SAP_API_BASE_URL=https://your-tenant-api.sap.hana.ondemand.com

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sap_integration_dashboard
DB_USER=postgres
DB_PASSWORD=your_password

# Server Configuration
PORT=3005
NODE_ENV=development

# CRON Schedule for Data Sync (every 30 minutes)
CRON_SCHEDULE="*/30 * * * *"

# Logging Configuration
LOG_LEVEL=info
LOG_FILE_PATH=logs/app.log

# Initial Sync
RUN_INITIAL_SYNC=true
```

4. Create the PostgreSQL database:

```bash
createdb sap_integration_dashboard
```

## Running the Service

### Development Mode

```bash
npm run dev
```

This will start the server with nodemon, which automatically restarts the server when changes are detected.

### Production Mode

```bash
npm start
```

## Database Schema

The service uses a comprehensive database schema to store all the required metrics for integration flows (iFlows), including:

- Security Mechanisms (Inbound and Outbound)
- Deployment Model (Hybrid, Cloud to Cloud, Cloud to Onprem, Onprem to Onprem, undefined)
- Error Handling (Detection, Logging, Classification, Reporting)
- Adapters (Senders and Receivers)
- Persistence (JMS, Data Store, Variables, Message persistence)
- Description
- Versioning (Draft, Versioned)
- MEP (Sync, Async)
- Interface Mode (real-time, Batch, event-driven)
- Message type (xml, Json, EDI)
- Deployment status
- Comparison of description vs implementation
- Name of the iflow
- Name of the Package
- Systems composition (SAP2SAP, SAP2NONSAP, NONSAP2NONSAP)
- Iflow Type (Standard, Custom)
- Flag based Logging
- Auditing
- Context
- Health Check
- Deployment Info (Version, Type, Deployed by, Deployed On, Status, Error Information)
- Runtime information (Endpoint, Message processing time, Failure/success, Scheduled/Ondemand/Both)

The database tables will be automatically created when the service starts in development mode.

## API Endpoints

### iFlow Endpoints

- `GET /api/iflows` - Get all iFlows with optional filtering
- `GET /api/iflows/:id` - Get a specific iFlow with all related data
- `GET /api/iflows/:id/history` - Get history of changes for a specific iFlow
- `GET /api/iflows/:id/deployment-history` - Get deployment history for a specific iFlow
- `GET /api/iflows/:id/runtime-history` - Get runtime history for a specific iFlow
- `GET /api/iflows/metrics/summary` - Get summary metrics for all iFlows

### Package Endpoints

- `GET /api/packages` - Get all packages with optional filtering
- `GET /api/packages/:id` - Get a specific package with its iFlows
- `GET /api/packages/:id/metrics` - Get metrics for a specific package

### Sync Endpoints

- `POST /api/sync` - Trigger an immediate data synchronization
- `GET /api/sync/status` - Get the status of the last synchronization

### Chat Endpoints

- `POST /api/chat/query` - Process a natural language query about integration flows

## Scheduled Data Synchronization

The service includes a scheduled job that periodically fetches data from the SAP Integration Suite APIs and updates the database. The schedule is configured using a cron expression in the `.env` file.

To change the schedule, update the `CRON_SCHEDULE` variable in the `.env` file. For example:

- `*/30 * * * *` - Every 30 minutes
- `0 * * * *` - Every hour
- `0 0 * * *` - Every day at midnight

## Logging

Logs are written to both the console and a log file. The log level and file path can be configured in the `.env` file.

## Error Handling

The service includes comprehensive error handling with detailed logging. Errors are logged with stack traces in development mode.

## Security

The service uses OAuth 2.0 for authentication with the SAP Integration Suite APIs. Client credentials are stored in the `.env` file and should be kept secure.

## License

This project is licensed under the ISC License.
