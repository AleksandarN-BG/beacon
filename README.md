# Beacon

> When downtime isn't an option.

A simple uptime monitoring application built with Azure Static Web Apps, Azure Functions, Azure Cosmos DB, and Azure Communication Services.

## Architecture

```
Azure Static Web Apps (Frontend)
         |
         v
Azure Functions (API)
         |
    +----+----+
    |         |
    v         v
Cosmos DB   Azure Communication Services
            (SMS + Voice Alerts)
```

## Features

- User authentication
- Monitor management (CRUD)
- Uptime status dashboard
- SMS alerts via Azure Communication Services
- Voice call alerts via Azure Communication Services

## Local Development

### Frontend

```bash
npm install
npm run dev
```

### API (Azure Functions)

```bash
cd api
npm install
```

To run locally, you'll need Azure Functions Core Tools:
```bash
npm install -g azure-functions-core-tools@4
func start
```

## Environment Variables

Create `api/local.settings.json` (not committed to git):

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "ACS_CONNECTION_STRING": "<your-acs-connection-string>",
    "ACS_PHONE_NUMBER": "<your-acs-phone-number>",
    "COSMOS_CONNECTION_STRING": "<your-cosmos-connection-string>",
    "COSMOS_DATABASE": "beacon",
    "COSMOS_CONTAINER_USERS": "users",
    "COSMOS_CONTAINER_MONITORS": "monitors",
    "COSMOS_CONTAINER_LOGS": "uptimeLogs"
  }
}
```

## Azure Setup

1. **Azure Static Web Apps** - Link to this GitHub repo
2. **Azure Communication Services** - Create resource, get connection string, provision phone number
3. **Azure Cosmos DB** - Create free tier account, create database "beacon" with containers: users, monitors, uptimeLogs

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/login` | POST | User authentication |
| `/api/status` | GET | Get all monitor statuses |
| `/api/monitors` | GET | List all monitors |
| `/api/monitors` | POST | Create new monitor |
| `/api/monitors?id=` | PUT | Update monitor |
| `/api/monitors?id=` | DELETE | Delete monitor |
| `/api/alert-sms` | POST | Send SMS alert |
| `/api/alert-call` | POST | Initiate voice call alert |

## License

MIT

