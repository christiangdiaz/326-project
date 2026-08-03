# Section 1

| Name           | GitHub Username |
| -------------- | --------------- |
| Christian Diaz | christiangdiaz  |
| Yougi Jain     | yougijain       |

# Section 2

- Communication as needed, daily / every other day via text.
- Done for a PR means passing review from other teammate.
- Will resolve disagreements by communicating openly and finding solutions that both are happy with.

# Section 3

Our team is building an apartment maintenance report board where residents submit maintenance problems with a simple description, and apartment maintenance answers and resolves issues. This addresses issues in poorly managed complaint systems for apartments that still track reports phone call by phone call. Residents also benefit by seeing the status and estimated fix time for their complaints instead of needing to call for updates over and over. Beyond the classroom, this reduces the gap that maintenance often needs to have in following up with residents, having to handle it themselves, and tracking and organizing complaints for them. Primary action would be submitting and resolving a complaint report by residents and maintenance staff, respectively, with staff-side status updates to be added in later sprints.

# Section 4: How to Get Started

1. Clone the repository `git clone https://github.com/christiangdiaz/326-project.git`
2. Install dependencies `npm install`
3. Start MongoDB. Any one of these works:
   - Docker: `docker run -d --name mongo -p 27017:27017 mongo:7`
   - A local `mongod` on the default port
   - Your own server: set `MONGODB_URI` before starting

   The app defaults to `mongodb://127.0.0.1:27017/maintenance_reports`. **No `.env` file and no secrets are required** — if you have MongoDB running on the default port, it just works.
4. Start the server with `npm start`
5. Finally, visit `http://localhost:3000` (or `http://localhost:3000/reports`) to see the Maintenance Report Board.

To run the test suite: `npm test`

# Section 5: Feature 1 - Report Submission

Primary action is a resident submitting a maintenance report.

- Visit `http://localhost:3000/reports`
- Two fields include **Unit number** and **Problem description** 
- **Submit report** button. This POSTs to `/reports`.
- Submission is validated in the service layer. A valid report is saved to the **MongoDB `reports` collection** with a MongoDB-generated `_id` and a default `status` of `Open`, then the new report appears in the **Submitted Reports** list.
- **Validation:** If a field is missing, the page re-renders with an inline error ("Unit number and description are required.") and an HTTP `400` status — nothing is saved.

# Sprint 3 Changes

## 1. MongoDB (Mongoose) repository, replacing the JSON file

`repositories/reportRepository.js` no longer touches the filesystem. It now defines a Mongoose schema and exposes **per-record** operations instead of the old whole-array `readReports` / `saveReports` pair.

**Schema** (`unit`, `description`, `status`, plus `timestamps`):

| Field | Type | Rules |
| --- | --- | --- |
| `unit` | String | required, trimmed, max 10 |
| `description` | String | required, trimmed, max 500 |
| `status` | String | enum `Open` / `In Progress` / `Resolved`, defaults to `Open`, indexed |

**Operations:** `getAll`, `findById`, `create`, `updateById`, `removeById`.

The connection lives in `config/db.js`, which reads `process.env.MONGODB_URI` and falls back to `mongodb://127.0.0.1:27017/maintenance_reports`. `reports.json` has been deleted from the repository.

**How to see it:** start MongoDB and run `npm start`, then submit a report at `http://localhost:3000/reports`. Both `GET /reports` and `POST /reports` now hit MongoDB. **Restart the server and the report is still there** — that is the proof it is no longer a JSON file. You can also inspect the collection directly:

```
docker exec -it mongo mongosh maintenance_reports --eval "db.reports.find()"
```

## 2. Jest tests for every service-layer business rule

`__tests__/reportService.test.js` covers all 18 cases with the repository replaced by `jest.unstable_mockModule`. **No database connection is opened** — the suite runs in roughly a quarter of a second.

Rules under test:

- `addReport` — unit required, description required, both rejected when whitespace-only, called with no argument at all
- `addReport` — unit at most 10 characters, description at most 500
- `addReport` — trims both fields, uppercases the unit, and forces `status: "Open"` even if the client supplies one
- `updateReportStatus` — id required, status must be one of the three allowed values, report must exist
- `deleteReport` — id required, report must exist
- Plus the happy path of each, asserting the repository is called with the right arguments and is **not** called at all when validation fails

**How to see it:** run `npm test`. To prove the suite is genuinely mocked rather than quietly talking to a real database, **stop MongoDB first** (`docker stop mongo`) and run it again — it stays green.

`updateReportStatus` and `deleteReport` back the repository's `updateById` and `removeById`, and are the service-layer seam the HTMX interaction calls.

# Honest Exceptions

The sprint brief asks us to name any layer above the repository that had to change. Two did, and here is exactly why.

**1. Async propagation reached above the repository.** Mongoose is asynchronous and Sprint 2's repository was synchronous, so `services/reportService.js` and `controllers/reportController.js` both became `async`/`await`. That is a real change above the repository line.

What did *not* change is the layering boundary: no layer above the repository knows a database exists, every function kept its name and arguments, and the controller still talks only to the service. What changed is the calling convention — functions return a Promise instead of a value. Had Sprint 2's repository been Promise-based from the start, nothing above it would have needed to change.

**2. The client-facing id.** Sprint 2's template emitted no record identifier at all: the `forEach` took no index and `report.id` was never rendered, so there was no array-position assumption to unwind. The exception shows up where per-record actions need a stable handle — each `<article>` in `views/reports.ejs` now carries `id="report-<%= report._id %>"`, MongoDB's real `_id`. The service's old `id: Date.now()` generation is gone; MongoDB assigns `_id` instead.

# System Diagram


![System diagram: the browser sends GET/POST /reports to routes, which call the controller, which calls the service (validation and business rules), which calls the repository. The repository is the only layer that talks to MongoDB, using Mongoose per-record operations getAll, findById, create, updateById and removeById. Alongside the service sits the Jest suite, which exercises the real service while replacing the repository with mocks via jest.unstable_mockModule, so no live database is involved. The controller renders HTML back to the browser.](assets/system-diagram.png)

