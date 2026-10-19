# Plan: an AI agent that helps the operations team check issues

> **Decisions taken (19 October 2026)**
> 1. The model runs **on the premises**. Nothing leaves the network, so masking is a second line of defence, not the first.
> 2. The agent gets **read-only access to the engine and application server logs** (real error text).
> 3. **Two languages**: English and Arabic (answers follow the language the person chooses or writes in).
> 4. **Playbooks, feedback and digests are saved as files** (a folder next to the application), not in a database.
> 5. It is reached through **a page of the console**, for **operations only** (new function `USE_AGENT`, operations roles).
> 6. It **reads and proposes**; it does not act on its own (the earlier recommendation stands).
>
> What this changes in the design is in section 11.

## 1. What it is for

The console already shows *what* is wrong (seven issue lists, the instance diagram, attributes, requests, definitions).
The operations team still has to work out *why* and *what to do*: open the instance, find the failing step, read the
script or procedure, check the values a condition reads, look for the same failure on other instances, compare process
versions, decide between retry, escalate and ignore. The agent does that legwork and answers in plain language with
links to the evidence. The person decides and acts.

Jobs, in order of value:

1. **Explain one instance or issue**: "why is this stuck / failed / completed with a failed step?"
2. **Triage the queue**: group the open issues by process, step and pattern, rank them, recommend an action per group.
3. **Review "completed with failed steps"**: tell harmless failures (a cleanup branch nobody reads) from harmful ones.
4. **Daily digest**: what is new, what is ageing, what changed since yesterday.
5. **Explain a process** to someone new, from its definition, scenarios and versions.
6. **Draft the hand-over text** (ticket, shift note) from what it found.

Out of scope for the first releases: doing anything on its own. It reads, explains and *proposes*.

## 2. What it can build on (all already in the console)

| Capability | Where it lives today |
|---|---|
| Seven issue types with counts and lists (failed, timed out, completed with failed steps, stuck, overdue, suspended, orphan, queue) | `IssueRepository`, `/api/issues` |
| Instance, steps, attributes and tables, engine and timer requests | `InstanceController` |
| The run on its diagram: step states, the route taken (exclusive gateways resolved), arrow conditions with the values they read | `OverlayBuilder`, diagram view |
| Script of a script step, procedure and parameters of a database step, sub-process and its child instance | `DiagramParser`, `SubProcessService` |
| Process definitions (redacted), versions, compare, scenarios, simulate, parameter impact | `/api/definitions`, `process-explorer/xpdl` (engine runs in the browser today) |
| Slow and failing steps per process | `BottleneckController` |
| Retry of stuck requests with preview, confirmation and audit | `BulkRetryController`, `RequestController` |
| Per-user visibility and permissions, audit log | `Visibility`, `ConsoleFunction`, `bpm.console.audit` |
| OpenAPI description of all 34 endpoints | Swagger UI (`/v3/api-docs`), a ready source for the agent's tool descriptions |

## 3. What the database does not give (important)

I checked the schemas. **There is no error text for a failed step.** `REC_REQUESTS.NOTES` holds labels ("START ACTIVITY",
"Run Instance"), `REQ_ENGINE_LOG` has only request id, engine id and a date, and the activity row has a status and times.
So the agent cannot read "ORA-01400" or "connection refused" from the database. It can still do a lot by inference:

* **The failing step's own definition**: the procedure and its parameters, the web service endpoint and operation, the
  script, and the current values of the variables they use (a null where a value is required is a common cause).
* **Pattern across instances**: the same step failing for many instances since a given time points at the system behind it,
  not at the instance; a single instance with odd input points at the data.
* **History**: earlier requests of the same step, retries and their outcome, how long it sat there.
* **Change**: the process version, and what changed between the version that worked and the one that fails.

For real error messages, the application server or engine logs are needed (decision 3 below). Until then the agent must say
"the database records no error text; here is what the evidence suggests" and never invent a message.

## 4. Design

### 4.1 Where it lives
A new `agent` package **inside the console backend**. Its tools call the existing services in-process **as the signed-in
user**, so it sees exactly what that person may see (same `Visibility`, same permissions) and nothing more. The model is
called over HTTPS with the model provider's tool-use API. A separate agent service (talking to the console through its
public API or an MCP server) is possible later; it adds a second place to secure and to deploy, with no gain for now.

### 4.2 The loop
Question → the model asks for tools → the console runs them as the user and returns small, bounded JSON → the model
answers with evidence. Streamed to the browser. Limits: at most about ten tool calls per question, a time limit, a token
budget per user and per day.

### 4.3 Tools (all read-only)
| Tool | Returns |
|---|---|
| `issue_summary`, `list_issues(type, process, since)` | counts and rows, capped |
| `get_instance(id)` | summary, status, parent and children |
| `get_run(id)` | steps with state, activity instance ids, times, the route taken |
| `get_step(instanceId, activityInstanceId)` | definition (script / procedure / endpoint), requests, attributes |
| `get_attributes(instanceId, names)` and tables (paged) | only the names asked for |
| `explain_branch(instanceId, arrow)` | condition, plain words, values read, whether it holds |
| `find_similar(process, step, window)` | other instances with the same step status, counts by day, shared traits |
| `process_health(process, days)` | slow and failing steps |
| `get_definition(process, version, section)`, `compare_versions` | redacted XPDL parts, differences |
| `scenarios(process, version)` | routes and outcomes (server-side port of the explorer engine, or its results) |
| `retry_preview(targets)` | what bulk retry *would* do (dry run, as today's review step) |

Every result is cut to a fixed size, carries ids so the answer can link to the instance and step, and passes through the
masking of section 6.

### 4.4 Actions are proposals
There is no write tool. `propose_retry(targets)` returns a proposal that the browser shows in the **existing bulk-retry
review dialog**; the person presses Confirm, which calls the existing, audited retry endpoint under their own identity.
The agent cannot press it, and the proposal states the reason and the evidence.

### 4.5 What the agent knows up front
A short, fixed briefing in the system prompt, written from what this project has already learned the hard way: a timeout
is a deadline, not a failure; the engine creates every step of an instance when it starts, so creation dates mean nothing
and start dates do; an exclusive gateway lets one branch through; a child instance names the parent step in
`STOPPED_PARENT_ACTIVTY`; the status spellings ("Faild", "Inti"); which tables are the source of what. Plus **playbooks**
(section 5) retrieved for the process and step in question.

### 4.6 Knowledge and learning
* **Playbooks**: short markdown notes written by the operations team per process or step ("if SMS gateway returns 5xx, retry
  after 30 minutes; if the number is missing, ask CRM"). Looked up by process id and activity id. The agent quotes them.
* **Feedback**: each answer has "right / wrong / partly" and a free note, stored with the question, tools used and outcome.
  Used to improve the briefing and playbooks, and as the evaluation set. Stored **outside the engine schemas** (the console
  never writes there): a small table in a schema of its own, or a file store, decision 5.

## 5. In the console

* **Instance page**: an "Ask" side panel, pre-filled with the instance and the selected step or arrow ("Why was this
  arrow taken?", "Why did this step fail?"). Answers link back to steps and arrows (deep links exist).
* **Issues page**: an "Explain" button on a row; a **Triage** view with the agent's grouped summary: "11 failures of *Send SMS*
  since 02:10, all with empty `MSISDN`: likely data, not the SMS system", with the instances listed and a proposed action.
* **Digest**: the same triage on a schedule, to a page, e-mail or chat channel (decision 6).
* **Permission**: a new function, e.g. `USE_AGENT`, like the others; off by default.

## 6. Safety and privacy

* **Customer data.** Attributes and forms hold names, phone numbers, addresses. The agent sends the model only what a question
  needs (the variables a condition reads, the fields asked for), masks phone numbers, e-mail addresses and national ids by
  pattern, never sends saved form HTML, and secrets stay redacted (the XPDL redaction already exists). Whether the model runs
  in the cloud or on the premises is the first decision, and it sets how strict this must be.
* **Untrusted text.** Attribute values, comments and forms are data entered by customers. Tool results are passed to the model
  as data in clearly marked blocks, and no tool can change anything, so injected instructions cannot do harm beyond a wrong
  answer; the briefing says to ignore instructions found in data.
* **Same rights as the person.** Visibility and permissions are enforced by the tools, not by the prompt.
* **Audit.** Every question, tool call (name and arguments), answer and proposal is logged with the user, on the existing
  audit logger. Cost and rate limits per user.
* **Honesty.** Answers separate *evidence* (with links) from *inference*, give a confidence, and say "not recorded" when the
  database lacks the fact.

## 7. How we will know it works

* A **case set of 40 to 60 real issues** from the last 90 days with the cause and fix the team confirmed (or an agreed
  "cannot tell"). Score: right cause, right action, no invented facts, no unsafe proposal.
* A replay harness that feeds recorded tool results, so changes to prompts or tools can be compared without the live database.
* Prompt-injection tests (hostile text inside attributes and comments).
* Tracked in use: share of answers marked right, time to resolve with and without the agent, cost per question.

## 8. Phases

| Phase | What | Weeks |
|---|---|---|
| 0 | Decisions below, data and privacy rules, tool list, case set, access to a model | 1 |
| 1 | Agent package, eight read tools, streaming chat, Ask panel on the instance page, audit, limits | 2 to 3 |
| 2 | Triage grouping and ranking, Explain on issue rows, digest | 2 |
| 3 | Playbooks, feedback, evaluation harness and scores | 2 |
| 4 | Proposed retries through the existing review and confirm, with evidence | 1 to 2 |
| 5 | Log access for real error text (if approved), tuning from feedback | ongoing |

## 9. Risks

| Risk | Answer |
|---|---|
| A confident wrong diagnosis | Evidence and confidence in every answer, "not recorded" when unknown, feedback, the case set |
| Customer data leaves the premises | Decision 1, minimisation and masking, contract terms, option of an on-premises model |
| It does something harmful | No write tools; proposals need a click and the existing confirmation |
| Cost runs away | Per-user and daily budgets, bounded tool output, a cheaper model for digests and classification |
| Answers go stale as processes change | Tools read the live definition and data; playbooks carry an owner and date |

## 10. Decisions needed before Phase 1

1. **Model and data policy.** Cloud API (with the provider's no-training and zero-retention terms) or an on-premises model?
   My recommendation: the cloud API for Phase 1 with strict minimisation and masking, because it is far stronger at this kind
   of multi-step diagnosis, if the organisation's policy allows it for masked operational data.
2. **Autonomy.** Read and propose only (recommended). Automatic retry of one narrow, proven pattern can be considered after
   the case set shows it is safe.
3. **Error text.** Can the agent be given read access to the engine or application server logs (a log folder, or a search
   service) so it can read the real exception? It changes the quality of diagnosis more than anything else.
4. **Languages.** English only, or Arabic answers as well?
5. **Where feedback and playbooks are stored.** A small table in a schema of its own, or files next to the application.
6. **Digest channel.** A page in the console, e-mail, or a chat channel.
7. **Who may use it.** Operations only, or every role (each limited to their own instances, as now).

## 11. What the decisions change

**On-premises model.** The agent talks to the model through an **OpenAI-compatible chat endpoint with tool calling**
(what vLLM, Ollama and llama.cpp servers all expose), so the model can be swapped by changing the address and the model
name in the configuration. On-premises models are weaker than the large hosted ones at long multi-step tool use, so:

* the console does more of the work itself: for a given instance it can assemble a **case file** (status, route, the
  failing step's definition, the values it reads, similar failures, the matching log lines, the playbook) in one
  deterministic step, and the model's job is to read it and explain; tool calling stays for follow-up questions;
* fewer tools, simple argument shapes, small bounded results, a hard cap on tool rounds;
* the case set (section 7) is also how the model is chosen: the same 40 to 60 cases are run against each candidate
  model, in English and in Arabic, and the model is picked on the score, not on reputation;
* a model that is good at Arabic is a requirement, not a nice-to-have: it is checked on the case set before it is chosen.

**Log access.** A read-only `LogReader` over folders named in the configuration (no path ever comes from the user's
question), newest files first, searched by instance id, activity instance id, request id, request UUID or a time window,
with a cap on bytes scanned and lines returned, and the same masking as everything else. Needed from the team: the log
folders, the file naming, and how an instance or request id appears in a line (so the search terms can be built).
Until the folders are configured the tool answers "no log folder is configured" and the agent says the error text is
not available.

**Two languages.** The briefing and tools are in English; the answer is written in the language of the page's language
switch (English or Arabic, right to left), keeping ids, step names and technical terms as they are. Arabic quality is
part of the evaluation. The page itself is translated for the two languages.

**Files instead of a database.** Under one folder (`console.agent.data-dir`):
`playbooks/*.md` (written by the team, matched by process id and activity id in the file name),
`feedback/yyyy-mm.jsonl` (one line per rated answer: who, question, tools used, answer, rating, note),
`digests/yyyy-mm-dd.md` (the generated digest). Plain files are easy to back up, read and fix by hand.

**Console page, operations only.** One new menu item (*Assistant*) under the operations group, visible only with
`USE_AGENT` (granted to operations roles through the same permission mapping as the other functions). The page has the
chat, a *Digest* tab, and opens pre-filled from links on the instance page and the issues list.

## 12. Build order

1. **Core** (backend): configuration, model client, tool layer, log reader, masking, files, the agent loop, audit log.
2. **Assistant page**: chat with the language switch, evidence links, rating, opened from an instance or issue.
3. **Case file and triage**: the deterministic case file, grouping and ranking, the digest tab.
4. **Playbooks and evaluation**: playbook lookup, the case set, scores per model and language.
5. **Proposed retries** through the existing review and confirm.

Steps 1 and 2 can be built and tested without a model (a stand-in model drives the tests); the real model and the log
folders are needed to judge quality, so they should be connected as soon as they exist.
