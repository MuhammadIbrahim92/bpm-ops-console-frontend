# Application search across all XPDL: plan

Status: plan only, nothing built. Decisions needed are in section 9.

## 0. Revision: search only the processes the user selects (replaces sections 5 to 7 where they differ)

The first draft indexed every XPDL in the background. That reads about 2,200 CLOBs (up to 1 MB each) from the engine
database, which is unwanted load. The search is now scoped by the user and nothing is read until they ask.

How it works:
- The page opens with a **multi-select of processes** (source, then process, then versions: Latest / All / pick). The list
  comes from the process and version listing the Design pages already use. It reads no XPDL.
- The user types the application (procedure, service, operation, endpoint, name) and presses **Search**. Only the selected
  versions are read.
- Hard limits: at most 50 versions per search (configurable `console.definitions.search-max-versions`), one at a time, with a
  short pause between reads, and a progress bar ("12 of 40 read") with a Cancel button. Cancel stops the reads.
- Results appear as each version is read, grouped by application and showing the activities that use it.
- A small in-memory cache holds the parsed result of each version read (keyed by version id and modified date, expires after
  `console.definitions.search-cache-minutes`, default 30). Repeat searches over the same selection, or a different search term,
  cost no further database reads.
- No background job, no index, no start-up cost, nothing is stored. The "Rebuild index" button goes away; "Clear cache" stays.
- Optional "Select all in this folder / group" shortcut, still bound by the 50-version limit, so a very wide search is a
  deliberate choice with a visible warning ("This will read 50 definitions").
- Saved selections (for example "Payments processes") kept in the browser, so a frequent search is one click. No server state.

API change: `POST /api/definitions/applications/search` with `{ source, versions: [ids], q, kind }`, returns a stream or pages of
per-version results so the page can show progress. Everything else in sections 4 and 6 (extraction, redaction, caps,
`VIEW_DEFINITIONS`) is unchanged.

Decisions 3 and 5 in section 9 no longer apply. New decision: is 50 versions per search the right ceiling?

## 1. Goal

An operator or designer types the name of a web service application or a database (stored procedure) application and sees every
process, version and activity, across all stored XPDL, that uses it. From a result they can jump into the process explorer
with that step selected.

Typical questions this answers:
- "We are changing procedure `PKG_X.GET_DAYS_BETWEEN`: which processes call it?"
- "The service at `https://host/ws/Foo` is down: which activities depend on it?"
- "Is this application used anywhere at all?" (the Inputs and outputs tab already shows used / not used per process; this is the cross-process view.)

## 2. What can be searched

| Kind | Fields matched (case-insensitive, contains) |
|------|---------------------------------------------|
| Database application (`Ejb`) | application id and name, stored procedure (`HomeClass`), method, JNDI / connection name |
| Web service application (`WebService`) | application id and name, service, operation (`WebServiceOperation`), endpoint URL (`ExternalReference Location`) |
| Both | activity name or id that uses it, mapped variable names |

A single box with a Kind filter (All / Database / Web service). Operators rarely know the kind, so All is the default.

## 3. Where the data is

Both repositories already read by the Design pages (`DefinitionRepository.Source`):
- `BPM_REPOSITORY.CFG_PROCESS_VERSION.PROCESS_DIAGRAM` (published): 831 versions
- `BPM_CONFIGURATION.CFG_PROCESS_VERSION.PROCESS_DIAGRAM` (design): 1,376 versions
- A CLOB per version, up to about 1 MB. Roughly 2,200 documents in total.

The console reads only. Nothing is written to the engine schemas.

## 4. Extraction (server side)

Reuse the parsing that `DiagramParser` already does for the instance diagram (`Applications`, `TaskApplication`, `DataFields`
mapping, plus the web service pseudo steps `TaskService` / `WebServiceOperation`), and add a small `ApplicationUsageExtractor`
that returns, per process version:

- applications defined (id, name, kind, procedure or service / operation / endpoint, connection)
- usages: application id -> list of activities (id, name, type, parameter -> variable mapping)
- applications defined but unused (so "not used anywhere" is a real answer)

Credentials in XPDL (connection strings with passwords) pass through the existing `XpdlRedactor` before anything is returned or
indexed.

## 5. Index design

Scanning 2,200 CLOBs on every search is too slow, so build an in-memory index and keep it fresh.

Options:

| | A. On demand with cache | B. Background index (recommended) |
|---|---|---|
| How | First search parses everything, result cached in memory | Index built at start-up in the background, refreshed on a timer |
| First search | Slow (tens of seconds; to be measured) | Instant once built; "index is building" until then |
| Freshness | Cache TTL | Refresh every N minutes by checking `max(modified date)` and version count per source, then re-parsing only new or changed versions |
| Memory | Same | Same: about one small record per application per version, a few tens of MB at most |
| Persistence | None | Optional file snapshot under `console.agent.data-dir`-style folder so a restart doesn't re-parse (nice to have, phase 2) |

Recommendation: B, in memory, with incremental refresh keyed on version id plus last-modified. A "Rebuild index" button for users
with the function, and the index status (count, built at, duration) shown on the page.

Parsing cost is the unknown. The probe I tried to run to time a database-side `INSTR` scan could not connect, so I'll measure
when building phase 1 and set the refresh interval from the real numbers.

Latest-only versus all versions is a user decision (section 9). The index holds all versions; the query filters.

## 6. API (under `VIEW_DEFINITIONS`, any role, same as the other Design pages)

- `GET /api/definitions/applications/search?q=&kind=ALL|DB|WS&source=ALL|PUBLISHED|DESIGN&latestOnly=true`
  returns applications grouped by identity (kind + procedure or operation + endpoint), each with a count and the usages:
  process, version, source, activity id and name, how it is mapped.
- `GET /api/definitions/applications/index` returns status.
- `POST /api/definitions/applications/index/rebuild` (rate limited, audited via `bpm.console.audit`).
- Result cap (for example 200 usages per application, 50 applications) with a "refine your search" note, so a one-letter search can't send megabytes.

Swagger documents these automatically.

## 7. UI

New page under the Design menu group: **Application search**.

- Search box, Kind (All / Database / Web service), Source (Both / Published / Design), "Latest versions only" toggle, index status line.
- Results as expandable panels, one per application: name, kind badge, procedure or endpoint, usage count.
  Inside: a table process / version / source / activity / how called, sorted by process then version.
- "Unused" applications flagged (defined but no activity uses them), with a filter.
- Clicking a row opens the process explorer on that process and version with the activity selected and highlighted on the diagram
  (needs a small deep-link parameter: `?step=<activityId>`; the explorer already has "Find step" and "Show on diagram").
- Optional link from an activity step popup in instance tracking: "Where else is this application used?" which pre-fills the search.
- Same look as the existing Inputs and outputs panels (collapsible groups).

## 8. Tests and phases

Phase 1: backend extractor + index + search endpoint
- Unit tests on real sample XPDL (a database app, a web service app, a pseudo web service step, an unused app, redaction).
- Index refresh test (new version appears, changed version re-parsed, deleted version dropped).
- Endpoint tests including permission and result caps.

Phase 2: frontend page + deep link
- Component spec (search, filters, grouping, empty and building states).
- Verify against the real database that counts match what the Inputs and outputs tab shows for a few processes.

Phase 3 (optional): file snapshot of the index, Excel export of usages, assistant tool "find where an application is used".

Rough size: phase 1 about a day, phase 2 about a day, phase 3 half a day.

## 9. Decisions needed

1. Sources: published only, design only, or both with a filter? (Recommended: both, filter on the page.)
2. Versions: latest version of each process by default, with a switch for all versions? (Recommended: yes.)
3. Index: in-memory, built in the background and refreshed incrementally (recommended), or on-demand only?
4. Matching: contains, case-insensitive on the fields in section 2? Also search mapped variable names, or leave that out?
5. Who may search: `VIEW_DEFINITIONS` (any role, like the other Design pages), or restrict the "rebuild index" button to operations roles?
6. Include the "Where else is this used?" link from instance tracking and the assistant tool in the first release, or later?

## 10. Risks

- Parse time for about 2,200 XPDL documents is not yet measured; mitigated by background build and incremental refresh.
- XPDL variants: some definitions may reference applications in forms the parser doesn't expect; the extractor must tolerate and count these as "unrecognised" instead of failing the whole index.
- Memory if the CLOBs grew a lot: the index stores extracted records only, never the XML.
