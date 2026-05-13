# Bitrix24 Lead Workflow

Bitrix24 Lead Workflow is a TypeScript-first workflow service and embedded Bitrix24 administration app for routing CRM leads across sales teams. It receives Bitrix24 CRM and task webhooks, assigns leads through configurable round-robin queues, creates follow-up tasks, escalates overdue work, and gives administrators a secure in-portal interface for changing workflow behavior without editing code.

The project is designed for sales operations teams that need more control than standard Bitrix24 automation rules provide: source-based lead distribution, deterministic assignment queues, manager escalation, and a lightweight operational control panel embedded directly inside Bitrix24.

## What Was Built

This codebase has been modernized in two major steps.

### TypeScript backend foundation

- Converted the remaining Bitrix helper modules from JavaScript to TypeScript.
- Removed `allowJs` from `tsconfig.json`, making the repo TypeScript-first.
- Added shared domain and Bitrix API types for webhook payloads, leads, tasks, comments, OAuth token state, and workflow configuration.
- Replaced loose controller casts with typed helper return values.
- Added ESLint and strict TypeScript checks to prevent new untyped patterns.
- Added focused tests around lead routing, overdue escalation, admin access, and workflow configuration validation.

### Embedded admin configuration app

- Added a React + Vite frontend served from the Express backend at `/app`.
- Added administrator-only APIs under `/api/admin/*`.
- Added Bitrix administrator access checks with an `ADMIN_USER_IDS` override list.
- Moved round-robin configuration from hardcoded constants into `/mnt/data/workflowConfig.json`.
- Added UI controls for teams, member user IDs, lead source routing, deadlines, workflow manager ID, and rotation indexes.
- Updated the webhook flow so lead assignment uses the saved workflow configuration.

## Core Capabilities

### Lead intake and assignment

Bitrix24 sends new lead events to:

```text
POST /bitrixworkflow/lead/add
```

The service then:

- Reads the lead ID from the webhook payload.
- Fetches full lead details from Bitrix24.
- Checks the configured source routing rules.
- Skips excluded sources.
- Selects the correct sales queue.
- Advances the queue's round-robin index.
- Updates the lead owner in Bitrix24.
- Creates a follow-up task for the assigned user.
- Persists the assigned responsible user for later handoff detection.

### Task comment workflow

Bitrix24 task comment events arrive at:

```text
POST /bitrixworkflow/task/comment/add
```

The controller reacts to two important task comment states:

- `Task closed.`: marks the related lead as `IN_PROCESS` and records the user as available for future reassignment.
- `Task is overdue.`: tries to reassign the lead to a completed/available salesperson, or escalates to the configured workflow manager when reassignment is no longer appropriate.

### Workflow manager handoff tracking

Lead ownership changes arrive at:

```text
POST /bitrixworkflow/lead/change
```

When the workflow manager manually reassigns a lead, the service detects the handoff, completes the manager task, and creates a new salesperson follow-up task for the newly responsible user.

### Embedded Bitrix24 admin app

The admin interface is served at:

```text
GET /app
```

It is intended to be registered as a Bitrix24 embedded app URL. Administrators can manage:

- Sales teams and Bitrix user IDs.
- Source-to-team routing rules.
- Excluded source IDs.
- Default routing team.
- Sales follow-up deadline.
- Workflow manager escalation deadline.
- Workflow manager user ID.
- Current round-robin indexes, including reset.

The UI is deliberately operational rather than marketing-oriented: compact, direct, and built for repeated use inside a CRM.

## Architecture

```text
.
|-- Bitrix24AuthUtils/
|   `-- Bitrix24AuthUtils.ts
|-- Bitrix24Helper/
|   |-- bitrixApi.ts
|   |-- createTaskForSalesPerson.ts
|   |-- createTaskForWorkflowManager.ts
|   |-- getMoreLeadData.ts
|   |-- getTaskInfo.ts
|   `-- ...
|-- Controllers/
|   |-- LeadAddController.ts
|   |-- TaskCommentAddController.ts
|   `-- leadChangeController.ts
|-- frontend/
|   |-- src/
|   |   |-- App.tsx
|   |   |-- main.tsx
|   |   `-- styles.css
|   `-- vite.config.ts
|-- routes/
|   |-- adminRoutes.ts
|   `-- routes.ts
|-- services/
|   |-- adminAccess.ts
|   |-- leadRouting.ts
|   |-- overdueEscalation.ts
|   `-- workflowConfig.ts
|-- tests/
|-- types/
|-- server.ts
|-- tsconfig.json
`-- package.json
```

### Server

The Express server is the single runtime entrypoint. It handles:

- OAuth callback and Bitrix token initialization.
- Webhook routes under `/bitrixworkflow`.
- Admin API routes under `/api/admin`.
- Static frontend delivery under `/app` after the frontend is built.

### Bitrix helper layer

The helper layer wraps Bitrix REST calls and returns typed domain objects instead of exposing raw SDK payloads to controllers. This keeps controller code focused on workflow behavior instead of response-shape plumbing.

### Workflow services

The service layer contains the decision logic:

- `leadRouting.ts` resolves source-based assignment.
- `overdueEscalation.ts` chooses reassignment vs manager escalation.
- `workflowConfig.ts` loads, validates, saves, and exposes workflow configuration.
- `adminAccess.ts` evaluates Bitrix administrator and override access.

### Frontend

The frontend is a Vite React app embedded into the same deployment. Production builds are emitted to:

```text
frontend/dist
```

The Express server serves this directory at `/app`.

## Runtime Configuration

The service uses environment variables for OAuth, deployment, and administrator overrides.

| Variable | Required | Description |
|---|---:|---|
| `PORT` | No | HTTP server port. Defaults to `3000`. |
| `BITRIX_CLIENT_ID` | Yes | Bitrix24 local app client/application ID. |
| `BITRIX_CLIENT_SECRET` | Yes | Bitrix24 local app secret. |
| `BITRIX_REDIRECT_URI` | Recommended | OAuth callback URL registered in Bitrix24. Defaults to `http://localhost:{PORT}/auth/callback`. |
| `WORKFLOW_MANAGER` | No | Initial workflow manager user ID used when seeding default config. Defaults to `1`. |
| `ADMIN_USER_IDS` | No | Comma-separated Bitrix user IDs allowed to access admin APIs even if Bitrix admin detection is unavailable. |

Example:

```env
PORT=3000
BITRIX_CLIENT_ID=local.XXXXXXXX
BITRIX_CLIENT_SECRET=xxxxxxxxxxxxxxxx
BITRIX_REDIRECT_URI=https://your-domain.example.com/auth/callback
WORKFLOW_MANAGER=1
ADMIN_USER_IDS=1,25
```

## Persisted Workflow State

The project currently stores operational state in `/mnt/data`, matching the existing deployment assumptions.

| File | Purpose |
|---|---|
| `/mnt/data/b24_tokens.json` | Bitrix OAuth token state. |
| `/mnt/data/workflowConfig.json` | Admin-managed routing, teams, deadlines, and workflow manager config. |
| `/mnt/data/sales_indices.json` | Current round-robin index per team. |
| `/mnt/data/leadResponsible.json` | Last known responsible user per lead. |
| `/mnt/data/SalesPersonWithCompletedTask.json` | Users who completed tasks and can receive overdue reassignment. |

On first run, `workflowConfig.json` is seeded with:

```json
{
  "teams": [
    { "name": "Sales Executives", "memberIds": [25, 29, 133] },
    { "name": "Telly Sales", "memberIds": [113, 115, 167, 203] }
  ],
  "sourceRouting": {
    "excludedSourceIds": ["UC_NNO79X"],
    "routes": [
      { "sourceIds": ["WEBFORM", "1|FACEBOOK"], "department": "Telly Sales" }
    ],
    "defaultDepartment": "Sales Executives"
  },
  "deadlines": {
    "sales": "1 hour",
    "workflowManager": "1 hour"
  },
  "workflowManagerId": "1"
}
```

The admin app edits this configuration through the protected API.

## API Reference

### Public and OAuth routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/` | Health/status response for the integration server. |
| `GET` | `/auth/callback` | Bitrix OAuth callback. Exchanges authorization code for tokens. |
| `GET` | `/app` | Embedded admin frontend. |

### Admin API

All admin API routes require Bitrix initialization and administrator access.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/admin/me` | Returns access status for the current Bitrix user. |
| `GET` | `/api/admin/workflow-config` | Returns workflow config plus current rotation indexes. |
| `PUT` | `/api/admin/workflow-config` | Validates and saves workflow config. |
| `PUT` | `/api/admin/workflow-config/indices` | Updates rotation indexes. Used for reset/edit operations. |

### Webhook API

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/bitrixworkflow/lead/add` | Processes new lead assignment. |
| `POST` | `/bitrixworkflow/task/comment/add` | Processes task completion and overdue comments. |
| `POST` | `/bitrixworkflow/lead/change` | Processes responsible-person changes. |

## Admin Access Model

The embedded app is intended for administrator-level CRM access.

Access is granted when either condition is true:

- Bitrix identifies the current user as an administrator.
- The current user ID appears in `ADMIN_USER_IDS`.

The override list exists because Bitrix admin detection can vary by app context and portal configuration. It gives operations teams a controlled fallback without weakening the default admin-only model.

Non-admin users receive `403 Forbidden` from protected admin endpoints.

## Bitrix24 App Setup

In Bitrix24, register this service as a local/embedded application.

Use these URLs:

| Setting | Value |
|---|---|
| Application URL | `https://your-domain.example.com/app` |
| OAuth callback URL | `https://your-domain.example.com/auth/callback` |
| Lead add webhook | `https://your-domain.example.com/bitrixworkflow/lead/add` |
| Task comment webhook | `https://your-domain.example.com/bitrixworkflow/task/comment/add` |
| Lead change webhook | `https://your-domain.example.com/bitrixworkflow/lead/change` |

Recommended Bitrix scopes:

- CRM access for lead reads and updates.
- Task access for task creation, lookup, and completion.
- User access for current-user/admin checks and task assignee lookup.

## Local Development

Install dependencies:

```bash
npm install
```

Run the full production build:

```bash
npm run build
```

Start the built server:

```bash
npm start
```

During frontend work, run the Vite dev server:

```bash
npm run dev:frontend
```

The frontend dev server runs from `frontend/vite.config.ts` and proxies `/api` to `http://localhost:3000`.

## Quality Checks

Run all checks before pushing:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

What each command verifies:

| Command | Purpose |
|---|---|
| `npm run typecheck` | Strict TypeScript pass without emitting files. |
| `npm run lint` | ESLint pass for TypeScript and frontend code. |
| `npm test` | Node test runner for workflow and access logic. |
| `npm run build` | Builds the Express server and Vite frontend. |

Current tests cover:

- Source-based lead routing.
- Overdue reassignment vs manager escalation.
- Admin access decisions.
- Workflow config validation.

## Deployment Notes

Build output is split by runtime:

- Server output: `dist/`
- Frontend output: `frontend/dist/`

The server serves `frontend/dist` at `/app` when that directory exists, so production deployments should run:

```bash
npm run build
npm start
```

Make sure the deployment environment has writable `/mnt/data` storage. If the host does not provide durable `/mnt/data`, configure equivalent persistent storage before using the app in production.

## Operational Workflow

1. Deploy the service and configure Bitrix OAuth credentials.
2. Visit `/` to confirm the service is running.
3. Authorize the Bitrix app through the generated authorization URL if tokens are not present.
4. Register `/app` as the embedded app URL in Bitrix24.
5. Open the app as an administrator.
6. Configure teams, routing sources, deadlines, and workflow manager ID.
7. Register Bitrix webhooks for lead add, task comment add, and lead change events.
8. Verify a test lead routes to the expected queue.

## Design Decisions

- The backend remains Express-based to preserve the existing webhook deployment model.
- The frontend is embedded into the same service to simplify hosting and Bitrix app registration.
- Configuration is stored in JSON files for compatibility with the current `/mnt/data` deployment pattern.
- Workflow decisions are extracted into services so they can be tested without live Bitrix calls.
- The UI manages user IDs directly because Bitrix user lookup/search was outside the first admin-app scope.

## Known Limitations

- Workflow state is file-backed, not database-backed.
- Round-robin index updates are not yet transactional across multiple server instances.
- Admin user detection depends on Bitrix current-user context; `ADMIN_USER_IDS` exists as a fallback.
- The admin UI manages Bitrix user IDs manually rather than searching Bitrix users by name.
- There is no audit log yet for configuration changes or escalation history.

## Recommended Next Improvements

- Move workflow configuration and indexes into a transactional database.
- Add an audit trail for admin config changes and lead assignment decisions.
- Add Bitrix user search/autocomplete in the admin UI.
- Add request signature verification for incoming Bitrix webhooks if available in the deployment setup.
- Add integration tests around webhook payloads with mocked Bitrix REST responses.
- Add richer operational dashboards for overdue leads, failed assignments, and escalation volume.
