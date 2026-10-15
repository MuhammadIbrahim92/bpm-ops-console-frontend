# BPM Operations Console - frontend

Angular 17 (standalone components, hash routing) UI for the operations team. Companion to the
`bpm-ops-console-backend` repository, which serves the JSON API and, in production, this UI from the same WAR.

## Screens

| Screen | Who | What it answers |
| --- | --- | --- |
| Dashboard | everyone | What needs attention right now: counts per problem type, oldest failed steps |
| Instances | everyone (own instances) / operations (all) | Find an instance by id, name, status, process, date, or "open longer than N hours" |
| Instance detail | same | The process **diagram with live state**: each step coloured by status, time spent or waited, who holds the task, overdue marks, arrows already travelled. Click a step for its history. Also a plain step list and, for operations, the engine requests for that instance with Retry |
| Issues | those with `VIEW_ISSUES` | Failed steps, stuck automatic steps, overdue tasks, suspended instances, instances going nowhere, and (operations) engine requests in trouble |
| Process health | those with `VIEW_ISSUES` | Per-step run counts, failures and average / slowest time for a process over 7, 30 or 90 days |
| Request queue | operations | The engine's request queue with filters, details, and a two-step **Retry** |

What a person sees is decided by the backend (roles and permissions come from the database role tables); the UI only
hides what the backend would refuse anyway.

## Sign-in

None here. WebLogic's container login and session protect the whole WAR. If the session expires, an API call comes
back as the login page and the app reloads so WebLogic shows the sign-in form again. POSTs (Retry) send the
`X-XSRF-TOKEN` header from the `XSRF-TOKEN` cookie automatically.

## Develop

```
npm install
npm start          # http://localhost:4200, /api proxied to http://localhost:8080
npm test           # Karma + Chrome headless
npm run build      # dist/bpm-ops-console/browser
```

For local work run the backend with `console.security.dev-user=<an SC_USERS user name>` (never on a shared server).

## Ship with the backend

```
npm run build
cp -r dist/bpm-ops-console/browser/* ../bpm-ops-console-backend/src/main/resources/static/
cd ../bpm-ops-console-backend && mvn package
```

All API calls use relative URLs (`api/...`) and `<base href="./">`, so the WAR's context root does not matter.

## Notes

* The diagram is drawn from the geometry the backend parses out of the stored diagram XML. The pure parts (geometry,
  formatting, status mapping) have unit tests; the Angular components have not been run in a browser yet.
* Dark mode follows the operating system setting. Status is always shown with a symbol and text, never colour alone.
* Process health lists steps by their activity id; showing step names there would need the backend to return them.
