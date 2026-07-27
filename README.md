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
3. Start the server with `npm start`
4. Finally, visit `http://localhost:3000` (or `http://localhost:3000/reports`) to see the Maintenance Report Board.

# Section 5: Feature 1 - Report Submission

Primary action is a resident submitting a maintenance report.

- Visit `http://localhost:3000/reports`
- Two fields include **Unit number** and **Problem description** 
- **Submit report** button. This POSTs to `/reports.
- Submission is validated in the service layer. A valid report is saved to `reports.json` with a generated `id` and a default `status` of `Open`, then the page reloads and the new report appears in the **Submitted Reports** list.
- **Validation:** If a field is missing, the page re-renders with an inline error ("Unit number and description are required.") and an HTTP `400` status — nothing is saved.

# System Diagram


![System diagram: Browser form submits GET/POST /reports to routes, which call the controller, which calls the service (validation + business rules), which calls the repository — the only layer touching reports.json. The controller renders HTML back to the browser.](assets/system-diagram.png)

