# Bitrix24 Lead Workflow

Bitrix24 Lead Workflow is a Node.js middleware service that sits between Bitrix24 webhooks and your internal lead-handling process. It receives CRM and task events, applies custom routing logic, assigns leads in a round-robin pattern, creates follow-up tasks, and escalates stalled leads when manual attention is required.

## Overview

This project exists because the default Bitrix24 automation rules are often not flexible enough for real-world sales operations. The current service helps teams:

- Route leads by source.
- Distribute leads across predefined sales queues.
- Create follow-up tasks for the assigned representative.
- React to task comments such as task completion or overdue status.
- Escalate unhandled leads to a workflow manager.
- Provide an embedded Bitrix24 admin app for workflow configuration.

## Current Capabilities

### Lead intake

- Accepts Bitrix24 webhook events for new leads at `/bitrixworkflow/lead/add`.
- Fetches additional lead details before assignment.
- Excludes leads from a specific source (`UC_NNO79X`).
- Routes `WEBFORM` and `1|FACEBOOK` leads to the `Telly Sales` queue.
- Routes other leads to the `Sales Executives` queue.

### Round-robin assignment

- Uses persisted workflow configuration to cycle through the configured members of each team.
- Updates the lead owner in Bitrix24.
- Creates a follow-up task for the selected representative.

### Admin configuration app

- Serves an embedded React app at `/app`.
- Restricts admin APIs to Bitrix24 administrators or IDs listed in `ADMIN_USER_IDS`.
- Lets administrators manage teams, source routing, task deadlines, workflow manager assignment, and rotation indexes.

### Task-driven workflow updates

- Accepts task comment webhooks at `/bitrixworkflow/task/comment/add`.
- Detects when a follow-up task is closed and moves the lead to `IN_PROCESS`.
- Detects overdue task comments and attempts reassignment.
- Escalates the lead to `WORKFLOW_MANAGER` when reassignment is no longer possible.

### Responsible-person tracking

- Accepts lead change webhooks at `/bitrixworkflow/lead/change`.
- Tracks handoffs involving the workflow manager.
- Completes the manager's reassignment task when ownership is changed manually.

## Project Structure

```text
.
|-- Bitrix24AuthUtils/
|   `-- Bitrix24AuthUtils.ts
|-- Bitrix24Helper/
|   `-- *.ts
|-- Constants/
|   `-- SalesTeam.ts
|-- Controllers/
|   `-- *.ts
|-- frontend/
|   `-- src/
|-- routes/
|   `-- *.ts
|-- services/
|   `-- *.ts
|-- types/
|   `-- *.ts
|-- server.ts
`-- package.json
```

## Request Flow

1. Bitrix24 sends a webhook to the Express server.
2. The controller resolves lead or task context through Bitrix24 helper functions.
3. Business rules determine the correct sales queue or escalation path.
4. The service updates the lead owner, creates tasks, or changes the lead stage.
5. The webhook returns `200 OK` so Bitrix24 does not keep retrying the same event.

## Configuration

The service depends on environment variables for OAuth and workflow behavior.

| Variable | Description |
|---|---|
| `PORT` | HTTP server port. Defaults to `3000`. |
| `BITRIX_CLIENT_ID` | Bitrix24 app client ID. |
| `BITRIX_CLIENT_SECRET` | Bitrix24 app client secret. |
| `BITRIX_REDIRECT_URI` | OAuth callback URI registered in Bitrix24. |
| `WORKFLOW_MANAGER` | User ID used for final escalation and manual intervention. |
| `ADMIN_USER_IDS` | Optional comma-separated Bitrix user IDs allowed to access admin APIs even if Bitrix admin detection fails. |

## Team Configuration

Workflow configuration is persisted to `/mnt/data/workflowConfig.json`. On first run, the app seeds the file with the original queues:

```js
{
  "teams": [
    { "name": "Sales Executives", "memberIds": [25, 29, 133] },
    { "name": "Telly Sales", "memberIds": [113, 115, 167, 203] }
  ],
  "sourceRouting": {
    "excludedSourceIds": ["UC_NNO79X"],
    "routes": [{ "sourceIds": ["WEBFORM", "1|FACEBOOK"], "department": "Telly Sales" }],
    "defaultDepartment": "Sales Executives"
  }
};
```

## API Endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/` | Health check and OAuth entry point. |
| `GET` | `/app` | Embedded Bitrix24 admin app. |
| `GET` | `/api/admin/me` | Resolve current admin access status. |
| `GET` | `/api/admin/workflow-config` | Read workflow configuration and rotation indexes. |
| `PUT` | `/api/admin/workflow-config` | Save workflow configuration. |
| `PUT` | `/api/admin/workflow-config/indices` | Save rotation indexes. |
| `POST` | `/bitrixworkflow/lead/add` | Process new lead events. |
| `POST` | `/bitrixworkflow/task/comment/add` | Process task comment events. |
| `POST` | `/bitrixworkflow/lead/change` | Process lead ownership changes. |

## Installation

```bash
npm install
```

## Running Locally

```bash
npm start
```

The server starts from [server.ts](/C:/Users/Usman%20Khan%20-%20PCI/Downloads/Bitrix24LeadWorkFlow-main%20(2)/Bitrix24LeadWorkFlow-main/server.ts) and exposes the webhook routes after Bitrix24 initialization succeeds.

For frontend-only local work:

```bash
npm run dev:frontend
```

The Vite dev server proxies `/api` to `http://localhost:3000`.

## Bitrix24 Embedded App Setup

- Register the app URL as `https://your-host.example.com/app`.
- Register the OAuth redirect URI as `https://your-host.example.com/auth/callback`.
- Grant CRM, task, and user access scopes needed by the workflow and admin guard.
- Add fallback administrators through `ADMIN_USER_IDS` if the portal admin flag is unavailable in your Bitrix environment.

## Known Gaps In The Current Codebase

The current implementation is functional as a proof of concept, but it still carries a few operational and architectural constraints:

- Workflow configuration still uses local JSON storage.
- State is stored locally through helper-managed files instead of a centralized datastore.
- Admin access depends on Bitrix user context plus the optional override list.

## Recommended Improvement Roadmap

Your consolidated suggestions fit well as the next professional roadmap for this project.

### 1. Upgrade the Bitrix24 integration layer

Standardize the integration around the Bitrix24 V2 JavaScript SDK, `@bitrix24/b24jssdk`, and use it consistently across authentication and REST calls. This will help with:

- REST API 3.0 compatibility.
- More consistent response handling.
- Cleaner helper abstractions.
- Easier long-term maintenance.

### 2. Migrate the codebase from JavaScript to TypeScript

Move controllers, helpers, and configuration modules to TypeScript to improve reliability in workflow logic. This migration should focus on:

- Typed webhook payloads.
- Typed Bitrix24 API responses.
- Safer routing and task-state transitions.
- Better IDE navigation and refactoring support.

### 3. Harden the round-robin assignment logic

The round-robin process should become resilient under concurrency and reassign overdue work automatically to the next valid representative. This should include:

- Atomic queue/index updates.
- Validation that a user is active and eligible before assignment.
- Safer reassignment rules when tasks become overdue.
- Better protection against duplicate or conflicting webhook processing.

### 4. Add a final escalation path

When several representatives fail to address the lead within the defined SLA, the workflow should trigger a final manager escalation. This can include:

- Escalation after a configurable number of failed handoffs.
- Dedicated notification events for managers.
- Escalation audit history for operational review.

### 5. Build an admin frontend

Create a dedicated frontend interface for operational management so administrators can:

- View the active workflow state.
- Add or remove people from the rotation in real time.
- Adjust assignments by role or queue.
- Review overdue leads and escalation history.

## Suggested Delivery Phases

### Phase 1: Stabilize the backend

- Fix current workflow edge cases.
- Add structured logging and input validation.
- Normalize Bitrix24 SDK usage.

### Phase 2: Move to TypeScript

- Introduce TypeScript configuration and build tooling.
- Migrate helpers first, then controllers and routes.
- Add shared types for webhook payloads and Bitrix entities.

### Phase 3: Introduce durable state

- Move queue, assignment, and audit state to a database.
- Replace file-based rotation tracking with transactional updates.

### Phase 4: Build the admin UI

- Add authenticated admin screens for queue management.
- Expose backend endpoints for live workflow configuration.

## Production Recommendations

- Run the service behind a process manager such as `pm2`.
- Store tokens and workflow state in durable storage instead of local files.
- Restrict filesystem and environment access because OAuth credentials are sensitive.
- Add request validation and event signature verification if your Bitrix24 setup allows it.
- Add automated tests before expanding business rules further.

## Next Best Step

If you want to modernize this repo incrementally, the strongest next move is:

1. Fix current backend edge cases.
2. Introduce TypeScript.
3. Replace local state with database-backed workflow storage.
4. Build the admin frontend on top of that stable backend foundation.
