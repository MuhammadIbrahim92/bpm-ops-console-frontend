# XPDL Workflow Explorer into the BPM Ops Console: analysis and migration plan

Source analysed: `XPDL Workflow Explorer (4).html` (517 KB; about 150 KB of code and a 380 KB embedded sample process).
Goal: bring its functions into the console as a **Process explorer**, where the person picks a **process** and a
**version** from the database instead of opening XPDL files.

---

## 1. What the HTML is

A single page with no libraries and no server calls. Everything runs in the browser.

| Part | What it does | Size (approx.) |
| --- | --- | --- |
| **Parser** (`xpdlToData`) | Reads the XPDL with `DOMParser`, builds activities (kind, name, details, scripts, parameters, performer, deadline), transitions (condition, name), the diagram geometry (`mxCell`, or `NodeGraphicsInfo`, or an automatic layout), header, data fields, applications, participants and extended attributes. | 120 lines |
| **Checks** (`deepChecks` plus inline checks) | About 60 checks in categories File, Duplicates, Naming, References, Data, Flow, Integration, Security, Diagram. Each gives a severity (fail, warn, info, ok), a description, the items concerned and a suggested fix. | 130 lines |
| **Expression engine** (`xlex`/`xparse`/`ev`/`exec`) | A small interpreter for the vendor's condition and script language (`[var] := ...`, `if/then/else/end`, `GetItem`, `&`, `\|`, comparisons). Used for syntax checks, simulation and impact analysis. Present twice in the file. | 60 lines |
| **Diagram view** | SVG drawn from the geometry; chips to filter by activity kind; zoom; click a step or a transition to see details and "in business terms"; **Trace from start** (step through the branches). | 100 lines |
| **Report** | Counts, problems by severity and category, "what the process does", web services and stored procedures called, human steps, timeouts, variables that drive routing. | 60 lines |
| **Inputs and outputs** | Every database application and web service with its parameters, technical settings and which steps use it; filter and search. | 25 lines |
| **Business guide** | Four tabs: Overview, Scenarios (distinct end-to-end routes with feasibility pruning), Decisions, Steps. Enumerates up to 5000 routes. | 60 lines |
| **Simulate** | Run the flow with chosen input values: scripts are executed, conditions evaluated, the person answers at web-service and user steps, with a variable table and log. | 70 lines |
| **Parameter impact** (`IMP`) | For one variable, tries a list of values through the flow and groups the outcomes ("what changes if this value changes"). | 80 lines |
| **Compare versions** | Two versions side by side: a technical diff (activities, transitions, conditions, scripts, services, data, participants, extended attributes, layout, validation) and a **business diff** in plain language with importance, themes and scenario differences. Copy as text. | 120 lines |
| **Chrome** | Open file, drag and drop, load sample, theme (light/dark), info dialogs. | 40 lines |

## 2. What I checked against your database

* The definitions live in `BPM_REPOSITORY.CFG_PROCESS_VERSION.PROCESS_DIAGRAM` (CLOB). **831 versions of 150
  processes; 830 contain a full `<WorkflowProcess>` and all 831 contain `mxCell`**. So the CLOB is a hybrid: an XPDL
  `Package` with `Participants`, `DataFields`, `Applications`, `WorkflowProcesses/WorkflowProcess/Activities/
  Transitions`, plus the diagram (`<Process><mxCell .../></Process>`). The console already reads the `mxCell` part.
* I ran the HTML's own parser (in a headless browser, offline) on three real versions:

  | Definition | Size | Activities / transitions | Parse | Route analysis |
  | --- | --- | --- | --- | --- |
  | process 4177, Version 6 | 99 KB | 21 / 21 | 62 ms | 6 routes, 4 ms |
  | process 4233, Version 16 | 90 KB | 16 / 17 | 29 ms | 3 routes, under 1 ms |
  | process 1947, Version 41 (largest) | 1.0 MB | 155 / 186 | 197 ms | 1,572 routes, 69 ms |

  Layout came from the file in all three. **The logic works unchanged on database content, and speed is not a
  concern** (largest definition about 1 MB, average 270 KB).
* Other facts that shape the plan:
  * Versions have `VERSION_NO` text ("Version 6"), `ACTIVE`, `PROCESS_STATUS` (ACTIVE 177, UNDER_TESTING 551,
    UNDER_LOADING_PROCESS 91, NOT_ACTIVE 5, ...), `PUBLISH_DATE`, `DESCRIPTION`. The same table also exists in
    `BPM_CONFIGURATION` (adds `OLD_VERSION`, no status) and `BPM_CONF`; the console uses `BPM_REPOSITORY`.
  * The package has no XML namespace (`Package`, attribute `id` = process id).
  * **The definitions contain `DBConnection` extended attributes (JDBC URLs).** The HTML hides values it considers
    sensitive; the console must not ship them to every browser (section 6).

## 3. What changes when the source is the database

| Topic | In the HTML | In the console |
| --- | --- | --- |
| Input | Open file, drag and drop, sample | Select **process** (searchable list) and **version**; optional "open file" kept for offline files |
| Compare | Two file slots | Two version selectors (same process by default, any process allowed) |
| "Is this valid XPDL?" checks | Namespace, package structure, standard enums, misspelled names, non-standard types | The vendor format always fails these. They become a **"BPM console profile"**: namespace and structure checks removed, known vendor elements and values whitelisted. Otherwise every definition shows about 10 false warnings (I saw them in all three tests). |
| Process-specific content | A 380 KB sample, `SETUP`, `HS`, `HR` dictionaries and hint text for one telecom process (variables like `Account_Type_20306070`) | **Removed.** The generic hints the file already derives from the diagram stay. Optional per-process hints become a config file later, not code. |
| Heuristics | `trials`/`trails` retry counters, `picks()` value suggestions, outcome classification by words like "close/reject" | Reviewed and generalised, or kept behind a clearly labelled "heuristic" note. They are the least portable part. |
| Links to the rest of the console | None | Deep links `#/definitions/<processId>/<version>`; "View definition" from an instance (its process id and version are known); later, overlay of live counts per step on the definition diagram |

## 4. Target design

### 4.1 Backend (read-only, Java 8, same patterns as today)

New package `com.bpm.console.definitions`; permission `VIEW_DEFINITIONS` (new function, mapped like the others in
`console.security.permissions.*`; proposal: operations only, section 8).

| Endpoint | Returns |
| --- | --- |
| `GET /api/definitions/processes` | Processes that have versions: id, name, number of versions, newest and active version |
| `GET /api/definitions/{processId}/versions` | `[{versionNo, active, status, publishDate, description, sizeBytes}]`, natural order (Version 2 before Version 10); no CLOB content |
| `GET /api/definitions/{processId}/versions/{versionNo}/xpdl` | The XML as `application/xml`, **redacted** (below), size cap, `Cache-Control: private, max-age=300`, audit log line (who, process, version) |

Redaction (server side, before the response): values of `ExtendedAttribute` whose name or value matches
`password|passwd|pwd|secret|token|jdbc:` are replaced by `***`; the parser keeps their hash so Compare still detects a
change (the HTML does this with `hsh`). Optional: strip `ExternalReference` hosts behind a setting.

No schema change, no write, no new grant: only `SELECT` on tables already read by `DiagramRepository`.

### 4.2 Frontend

New area `src/app/features/process-explorer/` in the Sakai layout (menu item **Process explorer**, under Operations or
a new Design group).

```
xpdl/                 pure TypeScript, no Angular, no DOM except DOMParser; unit-tested
  parser.ts           xpdlToData
  checks.ts           deepChecks + inline checks, with the "BPM console profile"
  expression.ts       lexer, parser, evaluator (one copy, the HTML has two)
  graph.ts            graph helpers, paths, feasibility, scenarios
  diff.ts             technical diff + business diff
  simulate.ts         simulation engine
  impact.ts           parameter impact
  layout.ts           automatic layout when no geometry
  worker.ts           heavy analysis off the UI thread
explorer-page.component.ts     process + version selectors, tabs, deep link
diagram.component.ts           SVG diagram (kind chips, zoom, select, trace)
panels/                        step/transition details, report, inputs and outputs, guide, simulate, impact, compare
```

* UI with PrimeNG as elsewhere: `p-select` (filter) for process and version, `p-tabs`, `p-table` for lists,
  `p-accordion`/`p-panel` for check groups, `p-dialog` only where a dialog really fits. Diagram colours come from CSS
  variables so dark mode works.
* **No `innerHTML`.** The HTML builds large HTML strings. In Angular every value goes through templates (escaped),
  which also removes the need for its `escH`.
* Parsing runs in the browser (about 60 to 200 ms); analysis and diff run in a **Web Worker** so large processes never
  freeze the page.
* Compare and "business diff" take two `ProcessData` objects, so the source of each side (DB or file) does not matter.

## 5. Phases

| # | Phase | Delivers | Done when |
| --- | --- | --- | --- |
| 0 | **Decisions and fixtures** | Answers in section 8; export 5 to 8 real definitions (small, large, with timers, with sub-processes) as test fixtures (credentials redacted) | Fixtures committed, decisions recorded |
| 1 | **Backend and viewer** | The three endpoints with redaction and tests; selectors; parser; diagram; step/transition details with "in business terms"; trace; kind filters; deep link | Pick any process and version and see its diagram and step details, matching what the HTML shows for the same file |
| 2 | **Report and Inputs and outputs** | Checks with the console profile (no false namespace/structure warnings), report page, integrations tab | The three sample definitions report only genuine findings; counts match the HTML on the same input |
| 3 | **Compare versions** | Version A and B selectors, technical diff and business diff, copy as text, "open this version" | Two versions of process 4177 produce the same differences as the HTML on the two files |
| 4 | **Guide, Simulate, Impact** | Business guide tabs, simulation, parameter impact, generalised and without process-specific hints | Works on at least three unrelated processes; heuristics labelled |
| 5 | **Integration and polish** | "View definition" from an instance, optional live counts per step on the diagram, CSV and copy exports, README, performance pass | Instance page links to the right version; dark mode checked; docs updated |

Phases 1 to 3 are the core. Phase 4 is the largest risk and can ship later. Rough effort: phase 1 about 3 days,
phase 2 about 2, phase 3 about 2, phase 4 about 4, phase 5 about 2 (single developer, including tests).

## 6. Security

* **Credentials and hosts in definitions.** JDBC connection strings were found in `DBConnection` attributes. They are
  redacted on the server, never sent to the browser. The HTML's "Credentials in the file" check stays, as a report
  of which attributes were redacted, with no values.
* **Permission.** Definitions describe integrations and logic; treat them as operations material (new
  `VIEW_DEFINITIONS`, default deny like every other function). Every download is written to the audit logger.
* **Untrusted content.** Definition text is data. Parse with `DOMParser` (no script execution), render only through
  Angular templates, cap the size accepted from the backend, and never evaluate anything from the XML (the expression
  engine interprets text with its own small parser; it does not call `eval`).
* **Optional file upload** (kept for offline files) is parsed in the browser only and never sent to the server.

## 7. Testing

* **Differential test.** Run the original HTML engine and the TypeScript port over the same fixtures in headless Chrome
  and compare: counts, check lists (after the profile change), diff results, scenario counts. This is the safety net
  for a port of about 1,000 dense lines.
* Unit tests per module in `xpdl/` (expression engine with the vendor syntax, checks, diff, graph).
* Backend tests: redaction (including a value hidden by name and by content), natural version order, size cap,
  permission, 404s. Mocked repositories for logic; read-only checks against the real database for the queries.
* Browser checks of the page with real definitions, including the 1 MB one, light and dark.

## 8. Decisions

**Answered on 2026-10-17:**

1. **Source:** both `BPM_REPOSITORY` and `BPM_CONFIGURATION`; the person chooses the source in the page (default: repository).
2. **Permission:** new `VIEW_DEFINITIONS`, **not limited to operations** (any role mapped to it in `console.security.permissions`).
3. **Scope:** everything, phases 1 to 5.
4. **Other:** menu item in a new **Design** group; "open a file" kept; redact only password/secret/token/jdbc attributes.

Because any role may hold the permission, server-side redaction is mandatory, not optional.

### Original questions


1. **Which table is the source?** `BPM_REPOSITORY.CFG_PROCESS_VERSION` (published versions, 831 rows, has status and
   publish date) is my default. `BPM_CONFIGURATION` is the design-time copy and may hold drafts. Do you want one or both?
2. **Who may see definitions?** My proposal is a new `VIEW_DEFINITIONS` permission, operations only.
3. **Scope now:** phases 1 to 3 first (viewer, report, compare), or everything including Simulate and Impact?
4. **Keep "open a file"** for offline files, next to the database selectors?
5. **Where in the menu:** under Operations, or a new group (for example "Design")?
6. **Redaction rule:** hide only attributes matching the password/secret/token/jdbc patterns (default), or also all
   external hosts and URLs?

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| Port of dense code introduces differences | Differential test against the original on real fixtures; port module by module |
| Vendor-format false positives in checks | Console profile in phase 2, checked on the three samples (about 10 false warnings each today) |
| Process-specific heuristics wrong for other processes | Remove hard-coded dictionaries; keep generic derivation; label heuristics; phase 4 last |
| Very large definitions (up to 1 MB, 155 activities measured) | Worker for analysis, route cap of 5000 as in the original, lazy tabs |
| Sensitive data in the XML | Server-side redaction, permission, audit log |
| Definition table is spread over three schemas | Decide in question 1; the console already reads the repository schema |

## 10. Status

Phases 1 to 5 are built: explorer (diagram, trace, deep link, file open), report with console profile, inputs and outputs, compare versions (business and technical), scenarios and step impact, and a "View definition" link from Process health. Backend: `/api/definitions/*` with `VIEW_DEFINITIONS`, server-side redaction, audit log. Not yet committed.
