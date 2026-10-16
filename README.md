# BPM Operations Console - frontend

Angular 21 UI for the operations team, built on the [Sakai-NG](https://github.com/primefaces/sakai-ng) admin template
(PrimeNG 21, Tailwind CSS 4, Aura theme). Standalone components, signals, hash routing. Companion to the
`bpm-ops-console-backend` repository, which serves the JSON API and, in production, this UI from the same WAR.

## Screens

| Screen | Who | What it answers |
| --- | --- | --- |
| Dashboard | everyone | What needs attention right now: counts per problem type, oldest failed steps |
| Instances | everyone (own instances) / operations (all) | Find an instance by id, name, status, process, date, or "open longer than N hours". Server-side paging, 25-200 per page |
| Instance detail | same | Tabs: **Diagram** (live state per step; click a step for a popup with its attributes, saved forms, engine and timer requests), **Steps** (paged, with task type, row details and the start form), **Attributes** (process attributes per data object), **Engine requests** (REC_REQUESTS and TIMER_REQUESTS, every column) |
| Issues | those with `VIEW_ISSUES` | Failed steps, stuck automatic steps, overdue tasks, suspended instances, instances going nowhere, and (operations) engine requests in trouble |
| Process health | those with `VIEW_ISSUES` | Per-step run counts, failures and average / slowest time for a process over 7, 30 or 90 days |
| Request queue | operations | The engine's request queue with filters, every column, and a two-step **Retry** |
| Bulk retry | operations (on Issues, *Failed steps* tab) | Tick failed steps, or import an Excel/CSV sheet of `ACTIVITY_INSTANCE_ID` and/or `INSTANCE_ID`; review what would happen for each instance (nothing changes yet), confirm once, and the newest request of each instance is re-queued |

What a person sees is decided by the backend (roles and permissions come from the database role tables); the UI only
hides what the backend would refuse anyway. The sidebar menu is built from the functions the backend granted.

## Layout and theme

* `src/app/layout/` is the Sakai shell (topbar, sidebar, menu, footer, theme configurator). The menu is in
  `app.menu.ts`; the topbar shows the signed-in user, an Operations tag and Sign out.
* `src/assets/layout/` and `src/assets/tailwind.css` come from the template's `sakai-assets` repository
  (copied in; there is no git submodule). The demo styles are not used.
* Light/dark mode and the primary colour are changed in the topbar (`.app-dark` class on `<html>`).
* `src/styles.css` only keeps what is specific to this app: a bridge from the console's colour variables to the
  PrimeNG theme, and the step colours (`.st-*`) used by the diagram.
* Status is always shown with a symbol and text (`app-status-badge`, a PrimeNG tag), never colour alone.

## Tables

Every table is a PrimeNG `p-table` with a shared toolbar (`shared/table-tools.component.ts`):

* **Sorting** by column. Server-paged tables (instances, request queue, steps) sort the whole result on the backend
  (`sort` and `dir` query parameters, a fixed list of columns); small tables sort in the browser.
* **Filtering**: per-column filters and a quick search box on tables held in the browser (issues, process health,
  dashboard, attributes, engine and timer requests). Server-paged tables filter through their search form.
* **Columns**: show/hide through the *Columns* menu, drag the column border to resize.
* **Export CSV** of the rows shown (current page for server-paged tables, filtered rows otherwise).
* **Clear** resets filters and sorting. Row details expand where a row has more columns than fit.

## Sign-in

The app shows its own sign-in page. User name and password are posted to `POST api/auth/login`; the backend answers
with a JWT that is kept in `sessionStorage` (cleared when the tab closes) and sent as `Authorization: Bearer ...` on
every API call. A 401 from the backend (expired or rejected token) returns to the form. The password is configured in
the backend (`console.security.default-password`).

## Saved HTML and static resources

* Forms saved by the engine (work item HTML, start form) are shown in a sandboxed iframe: scripts may run, but the
  frame has an opaque origin (no access to the app, its storage or its token), cannot submit forms or navigate the
  page, and a content policy limits it to this app's own origin. See `shared/saved-html.component.ts`.
* `src/resources` is served at `/resources` (see `angular.json`), so saved HTML can link
  `./resources/css/stylesheet.css` and the other files.

## Develop

Needs Node 20.19 or newer.

```
npm install
npm start          # http://localhost:4200, /api proxied to http://localhost:8080
npm test           # Karma + Chrome headless (set CHROME_BIN if Chrome is not found)
npm run build      # dist/bpm-ops-console/browser
```

For local work run the backend with `console.security.default-password` set, then sign in with an `SC_USERS` user name.

## Ship with the backend

```
npm run build
cp -r dist/bpm-ops-console/browser/* ../bpm-ops-console-backend/src/main/resources/static/
cd ../bpm-ops-console-backend && mvn package
```

All API calls use relative URLs (`api/...`) and `<base href="./">`, so the WAR's context root does not matter.

## Notes

* The diagram is drawn from the geometry the backend parses out of the stored diagram XML. The pure parts (geometry,
  formatting, status mapping, interceptor rules) have unit tests; the components are checked in the browser.
* The app keeps zone.js (`provideZoneChangeDetection`); Angular 21 would otherwise run zoneless.
* Process health lists steps by their activity id; showing step names there would need the backend to return them.
* The instances list with test instances included can take about 20 seconds on a large database (the backend count
  and visibility query); without test instances it is fast.
