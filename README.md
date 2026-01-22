# Beacon

> When downtime isn't an option.

An incident reporting and on-call management system built with Vue.js, Azure Static Web Apps, Azure Functions, Azure Cosmos DB, and Twilio.

## Features

- **Incident Reporting** - Report and track incidents with severity levels
- **On-Call Schedule** - Manage who's on-call and when
- **Severity-Based Alerts**:
  - Low: Log only
  - Medium: Email notification
  - High: SMS to on-call engineer
  - Critical: Phone call + SMS
- **Role-Based Access** - Admin and user roles
- **Microsoft Entra ID (Azure AD) Auth** - Secure organizational authentication

## Architecture

```
Azure Static Web Apps (Vue.js Frontend)
         |
         v
Azure Functions (API)
         |
    +----+----+
    |         |
    v         v
Cosmos DB   Twilio
            (SMS + Voice Alerts)
```

## Cosmos DB Containers

- `users` - User roles
- `incidents` - Incident reports
- `schedule` - On-call shifts

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
func start
```

## API Endpoints

| Endpoint | Method | Description | Role |
|----------|--------|-------------|------|
| `/api/incidents` | GET | List all incidents | authenticated |
| `/api/incidents` | POST | Report new incident | authenticated |
| `/api/incidents?id=` | PUT | Update incident | authenticated |
| `/api/schedule` | GET | Get on-call schedule | authenticated |
| `/api/schedule` | POST | Add shift | admin |
| `/api/schedule?id=` | DELETE | Remove shift | admin |
| `/api/alert-sms` | POST | Send SMS alert | admin |
| `/api/alert-call` | POST | Initiate call | admin |

## Environment Variables

See `api/local.settings.json` for required settings.

## License

MIT

