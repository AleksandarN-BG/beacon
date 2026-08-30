# Beacon

> When downtime isn't an option.

An incident reporting and on-call management system built with Vue.js, Azure Static Web Apps, Azure Functions, Azure Cosmos DB, and Twilio.

Live: <https://white-water-0c82ab803.6.azurestaticapps.net/>

Built for the *Elektronsko poslovanje* course at MEF, where the brief was a
business model; the product was built alongside the pitch rather than instead of
it. The commercial case (competitive analysis, pricing tiers, TAM/SAM/SOM, Lean
Canvas) is a hypothesis, not a result -- there are no pilot teams yet.

## Features

- **Incident Reporting** - Report and track incidents with severity levels
- **On-Call Schedule** - Manage who's on-call and when
- **Severity-Based Alerts**:
  - Low: Log only
  - Medium: SMS notification
  - High: Phone call + SMS to on-call engineer
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

The API is one folder per HTTP route, over a shared layer that owns everything
more than one route needs:

```
api/
  shared/
    cosmos.js          one Cosmos client for the whole app
    config.js          application settings -> config object
    auth.js            identity from the SWA client-principal header
    oncall.js          who is on call right now
    notify.js          outbound SMS and voice
    twilio-webhook.js  proof a webhook really came from Twilio
    logger.js          system events, persisted for the dashboard
  incidents/  schedule/  users/  account/  logs/  get-roles/  debug/
  alert-sms/  alert-call/        manual escalation, admin or engineer
  voice-twiml/  call-events/     Twilio webhooks, signature-verified
```

`shared/cosmos.js` constructs the client once at module scope. Creating one per
request -- which nine call sites used to do -- gives each its own connection
pool, and a warm Functions instance accumulates them until it stops being able
to open sockets.

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
| `/api/alert-sms` | POST | Text the on-call engineer | admin or engineer |
| `/api/alert-call` | POST | Ring the on-call engineer | admin or engineer |
| `/api/logs` | GET | System event log | admin or engineer |
| `/api/voice-twiml` | POST | TwiML, and keypad acknowledgement | Twilio signature |
| `/api/voice-twiml` | GET | Liveness check only | anonymous |
| `/api/call-events` | POST | Twilio delivery/call status | Twilio signature |

The two alert endpoints exist for checking that paging works before it is
needed. They take no destination: the number is resolved from the on-call
schedule, so a caller cannot choose who gets rung. Incident-driven alerts do not
pass through them at all -- `incidents` calls `shared/notify` directly.

## Environment Variables

Set these as Application Settings in Azure. For local development put them in
`api/.env`, which is gitignored.

### Required

- `COSMOS_CONNECTION_STRING`
- `COSMOS_DATABASE` (defaults to `beacon`)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `AAD_CLIENT_ID`
- `AAD_CLIENT_SECRET`
- `STATIC_WEB_APP_URL` -- this deployment's public origin. Twilio fetches TwiML
  and posts status callbacks through it, because the Function App itself
  requires authentication, and the webhook signature is checked against it.

### Local development only

- `ALLOW_BODY_IDENTITY` -- when `"true"`, the API will accept the caller's
  identity from the request body instead of requiring the
  `x-ms-client-principal` header that Static Web Apps injects.

  **Never set this in Azure.** The header is signed by the platform and cannot
  be forged; a request body can be. With this on, any caller can name themselves
  any user and claim any role, which gates incident creation and the outbound
  phone alerts. It exists only so the Functions host can be run locally without
  SWA in front of it, and it defaults to off.

- `ALLOW_INSECURE_WEBHOOKS` -- when `"true"`, skips the Twilio signature check
  on `/api/voice-twiml` and `/api/call-events`.

  **Never set this in Azure.** Only Twilio can produce a valid signature, so
  without one there is no way to exercise those routes by hand. With this on,
  anyone who knows an incident id can acknowledge it by requesting a URL.

## Authentication

Identity comes from the `x-ms-client-principal` header. Roles are read from it
when Static Web Apps supplies them (Standard plan) and otherwise looked up in the
`users` container, which also auto-provisions a record on first sign-in so the
Free plan works.

Note what auto-provisioning implies: the identity provider is the `common` Azure
AD tenant, so **any** Microsoft account can sign in and will be given a record
with the `user` role. Being signed in is therefore not a permission -- every
route that does something has to check for `admin` or `engineer` explicitly.

### Webhooks

`/api/voice-twiml` and `/api/call-events` must be anonymous, because Twilio
cannot authenticate against Azure AD. The SWA route config cannot protect them,
so the handler is the only gate, and it verifies Twilio's HMAC-SHA1 signature
over the full request URL and body. Two rules follow:

- Anything that changes state requires a valid signature, and the check fails
  closed -- a missing `TWILIO_AUTH_TOKEN` rejects rather than admits.
- Only `POST` can change state. Twilio fetches TwiML with POST and posts the
  keypad result, so `GET` is never part of a real call. It answers a fixed
  liveness string and reads no parameters, which is why adding a query string
  to it cannot acknowledge anything.

## License

MIT

