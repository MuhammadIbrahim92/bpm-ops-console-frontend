# BPM Operations Console - product demo blueprint

Target length: **about 9 minutes 30 seconds** (voiceover at roughly 140 words per minute, about 1,300 spoken words).
Audience: operations leads, support engineers and process owners who run workflows on the BPM engine.
Format: screen recording at 1920x1080, light theme for most scenes, one dark-mode moment.

---

## 0. Before you record

| Item | Setting |
| --- | --- |
| Environment | A demo or test copy of the database. The console has one write (**Retry**); do not retry anything on production. |
| Sign-in user | Use a user whose roles are in `console.security.operations-roles`, so the Request queue and Retry are visible. A second, non-operations user is useful for the "what people see" shot. |
| Demo instance | One finished instance with a start form, a user task with a saved form, a service task with a request UUID, timers, and a few attributes. In the development data this was instance **276830629** (Vacation request flow, test instance). |
| Data prep | Open the Instances list once before recording (with test instances it can take about 20 seconds on a large database). Record from a state where lists are already loaded, or cut the wait. |
| Browser | 1920x1080, 100% zoom, bookmarks bar hidden. Show only `localhost` or your demo host in the address bar. |
| Privacy | Blur or replace real user names, request commands and form contents. Do not show the password or token. |
| Audio | Record the voiceover separately, then lay it over the footage; leave 0.5 s of silence at the start and end of each scene. |

---

## 1. Scene list at a glance

| # | Scene | Start | Length |
| --- | --- | --- | --- |
| 1 | Cold open: the problem | 0:00 | 0:30 |
| 2 | Sign in | 0:30 | 0:35 |
| 3 | Dashboard: what needs attention | 1:05 | 0:50 |
| 4 | Instances: find anything fast | 1:55 | 1:00 |
| 5 | Instance detail: the live diagram | 2:55 | 0:55 |
| 6 | Click a step: attributes, saved forms, queues | 3:50 | 1:15 |
| 7 | Steps tab: task types, request UUID, start form | 5:05 | 0:55 |
| 8 | Attributes and engine requests | 6:00 | 1:00 |
| 9 | Issues and process health | 7:00 | 1:05 |
| 10 | Request queue and safe retry | 8:05 | 0:50 |
| 11 | Working the way you like: tables, themes, access | 8:55 | 0:30 |
| 12 | Close | 9:25 | 0:15 |

---

## 2. Scene-by-scene script

### Scene 1 - Cold open: the problem (0:00 - 0:30)

**Visual**
- 0:00 Black, then the title card: **BPM Operations Console** with the line "See what your workflows are doing, and what is stuck."
- 0:08 Screenshot A: a blurred, busy database tool (many tables, a long query) fading into the clean console dashboard (Scene 3 frame).

**Screenshot asset A** - Dashboard at 1920x1080, signed in, light theme, five stat cards visible.

**Voiceover**
> When a business process stops moving, the answer is buried in tables: instances, activities, work items, request queues, timers. Finding it means writing queries and knowing the schema. The BPM Operations Console puts all of that in one place, on top of the process diagram you already know. Let's take a look.

**Transition:** quick cross-fade to the sign-in page.

---

### Scene 2 - Sign in (0:30 - 1:05)

**Visual**
- 0:30 Sign-in page, centered card, product name, "Sign in to continue".
- 0:38 Type the user name; the password field shows dots.
- 0:46 Click **Sign in**; the dashboard loads. Callout (lower third): "JWT sign-in. Rights come from your BPM roles."
- 0:55 Hover the top bar: user name and the **Operations** tag; hover the tag to show the roles tooltip.

**Screenshot assets**
- B: sign-in page, empty.
- C: top bar close-up with user name, Operations tag, theme toggle, Sign out.

**Voiceover**
> Sign in with your BPM user name. The console checks your account and your roles in the BPM database, so what you see here matches what you are allowed to do in the platform. Operations staff see every instance and the request queues; everyone else sees only the instances they are involved in.

**Transition:** slide-in of the dashboard.

---

### Scene 3 - Dashboard: what needs attention (1:05 - 1:55)

**Visual**
- 1:05 Dashboard wide. Cursor traces the stat cards left to right: Failed steps, Instances going nowhere, Stuck automatic steps, Overdue tasks, Suspended instances.
- 1:20 Hover a card with a non-zero count (it turns the number red); click it. The Issues page opens on that type.
- 1:30 Back to the dashboard. Scroll to **Oldest failed steps** table; click the **Since** header to sort, then use the instance link to open one.
- 1:45 Callout: "Counts come straight from the engine's own tables."

**Screenshot assets**
- D: stat cards with at least one red count.
- E: "Oldest failed steps" table with a sorted column and the filter icon in a header.

**Voiceover**
> The dashboard answers one question: what needs attention right now? Failed steps, instances that are going nowhere, automatic steps that have been running too long, overdue tasks, and suspended instances. Each card is a doorway: click one to see the full list, oldest first, and open any instance with a single click.

**Transition:** click "Instances" in the sidebar; the content slides.

---

### Scene 4 - Instances: find anything fast (1:55 - 2:55)

**Visual**
- 1:55 Instances page. Show the filter form: id or name, status, process, created by, dates, "open longer than N hours", "include test instances".
- 2:05 Type a name fragment, choose a status, press **Search**. The table updates; the URL changes (callout: "Searches are shareable links.").
- 2:20 Click the **Created** header twice (ascending, then descending). Callout: "Sorting runs on the server, across all results."
- 2:30 Open the **Columns** menu, hide two columns, show **Finished**; drag a column border to resize.
- 2:40 Change **Per page** to 100; click **Export CSV** (file appears in the browser's download bar).
- 2:50 Click an instance id to open it.

**Screenshot assets**
- F: filter form filled with example values.
- G: table with a sorted column arrow, column chooser open, status tags visible.
- H: paginator showing "1 to 50 of N instances" and the page-size selector.

**Voiceover**
> Search running and finished instances by id, name, status, process, creator or date, or ask for everything that has been open longer than a day. Sort any column, choose which columns you want, resize them, change the page size, and export the result to CSV. The page and filters live in the address bar, so you can share exactly what you are looking at.

**Transition:** click an instance; cut to the instance header.

---

### Scene 5 - Instance detail: the live diagram (2:55 - 3:50)

**Visual**
- 2:55 Instance header card: name, process and version, status tag, started by and when, running and failed step counts.
- 3:05 Diagram tab. Pan slowly across the process drawing. Zoom with the toolbar buttons; click **Fit**.
- 3:20 Point at coloured nodes: completed (green), running (blue), failed (red), not reached (grey); arrows already travelled are heavier.
- 3:35 Click an unreached or failed node to show the side panel facts: executions, first started, time spent here, who holds the task.

**Screenshot assets**
- I: full instance page with the diagram and legend (Running, Completed, Failed, Suspended, Not reached).
- J: side panel with execution facts for a step.

**Voiceover**
> This is where the console earns its keep. Your process drawing, with the live state of this instance on top. Green steps are done, blue ones are running, red ones failed, grey ones were never reached, and the path already taken is drawn heavier. Zoom and pan like a map. The side panel tells you how many times a step ran, how long it took, and who is holding the task right now.

**Transition:** click a step on the diagram; the detail dialog opens.

---

### Scene 6 - Click a step: attributes, saved forms, queues (3:50 - 5:05)

**Visual**
- 3:50 Click a user-task node. A dialog opens with the step name, a **User task** tag and the activity id.
- 4:00 Scroll: **Attributes**, grouped in collapsible panels per data object (for example "Request", "Status"), each tagged with its DO id.
- 4:15 Scroll to **Saved form**: the HTML the user completed, styled with the company stylesheet; scroll inside the form.
- 4:30 Scroll to **Engine requests** and **Timer requests** for this step: statuses and timestamps. Click **Details** on a timer row to show every column of the timer row.
- 4:45 Close the dialog (Esc). Click the **Start** node: the dialog shows the **Start form** the instance was created with.
- 4:58 Click a service-task node: callout "Request UUID: the engine request that ran this step."

**Screenshot assets**
- K: step dialog with attribute panels and the saved form visible.
- L: engine and timer request tables with one row expanded to show all columns.
- M: start-event dialog showing the start form.
- N: service-task dialog with the Request UUID block.

**Voiceover**
> Click any step and a window opens with everything that happened there. The attributes of that step, grouped by the data object they belong to. The form the person actually filled in, exactly as it was saved. And the engine and timer requests that were queued for this step, with every column of the request available. Click the start event and you get the form the instance was started with. For a service task, you also get the request UUID, which is the key to follow the call in the engine logs.

**Transition:** close the dialog; click the **Steps** tab.

---

### Scene 7 - Steps tab: task types, request UUID, start form (5:05 - 6:00)

**Visual**
- 5:05 Steps tab. The **Start form** button at the top; the legend of step types on this page (Start event, User task, Script task, Service task, Database task, Exclusive gateway...).
- 5:15 The table: step, **Type** tag, status tag, **Request UUID** (service tasks only), started, finished.
- 5:25 Click the **Step** header to sort across all steps (server-side); click **Started** descending.
- 5:35 Click the chevron on a row: attributes of that execution and any saved form appear inline.
- 5:45 Open **Columns**, toggle **Request UUID** off and on. Click **Export CSV**.

**Screenshot assets**
- O: steps table with the type tags and Request UUID column.
- P: an expanded row with attributes and a saved form.

**Voiceover**
> The Steps tab is the same story as a table. Every step is labelled with its type: user task, script, database, service, gateway. Service tasks show their request UUID. Sort by start time to read the instance as a timeline, open a row for its attributes and saved forms, and export the list when you need to attach it to a ticket.

**Transition:** click the **Attributes** tab.

---

### Scene 8 - Attributes and engine requests (6:00 - 7:00)

**Visual**
- 6:00 Attributes tab: panels per data object, each with a table (Attribute, Type, Value).
- 6:10 Type "status" in the search box: every panel filters at once; clear it.
- 6:20 In one panel, click the **Value** header to sort and use the filter icon on **Attribute**.
- 6:30 Click **Export CSV**.
- 6:38 **Engine requests** tab: two tables, REC_REQUESTS and TIMER_REQUESTS. Click **Details** on a row; the full column set appears.
- 6:50 Type a step id in the timer search box to narrow it.

**Screenshot assets**
- Q: attribute panels with search term applied.
- R: expanded REC_REQUESTS row showing every column (REQUEST_ID ... REQUEST_COMMAND).
- S: expanded TIMER_REQUESTS row showing the timer fields.

**Voiceover**
> Attributes are grouped the way the process designer grouped them, one panel per data object. Search across all of them at once, sort, filter by column, and export. The Engine requests tab shows what the engine did and what it still has scheduled for this instance: the request queue and the timer queue, with every column of every row one click away.

**Transition:** click **Issues** in the sidebar.

---

### Scene 9 - Issues and process health (7:00 - 8:05)

**Visual**
- 7:00 Issues page: tabs with counts (Failed steps, Instances going nowhere, Stuck automatic steps, Overdue tasks, Suspended instances, Engine requests in trouble).
- 7:10 Switch tabs. Show the hint line under the tabs, severity tags, and a long "Since" age.
- 7:22 Use column filter on **Process**; then the search box. Click **Export CSV**.
- 7:35 Process health page: choose a process and **Last 30 days**; **Show**.
- 7:45 Sort by **Average time**; point at the progress bars; filter the **Failed** column to > 0.
- 7:58 Callout: "Where does this process lose time?"

**Screenshot assets**
- T: Issues page with tab counts and filtered table.
- U: Process health table sorted by average time with bars.

**Voiceover**
> The Issues page gives you every problem the console can detect, grouped by type and sorted by how long it has waited. Process health looks at the other end of the problem: for a process and a period, which steps are slow, which fail, and where the longest waits are right now. It is the quickest way to find the step that deserves a fix.

**Transition:** click **Request queue** in the sidebar (operations user).

---

### Scene 10 - Request queue and safe retry (8:05 - 8:55)

**Visual**
- 8:05 Request queue page (operations only). Filters: request id or command text, status, type, dates.
- 8:15 Filter to a status such as "Request Timeout"; sort by **Requested**.
- 8:25 Expand a row: every column of the request.
- 8:35 Click **Retry** on a retryable row. A confirmation appears: "Run request N again?" Click **Cancel** (do not confirm on production).
- 8:48 Callout: "Retry is the only change the console can make. It is limited by status, age and instance state."

**Screenshot assets**
- V: request queue with filters and the Retry button.
- W: the "Run request N again?" confirmation.

**Voiceover**
> Operations staff also get the full request queue. Filter by status or command text, open any request to see everything the engine recorded, and, when a request is stuck, put it back in the queue. Retry asks you to confirm, only works on statuses you have configured, never on finished or terminated instances, and is written to an audit log. It is the only change this console can make.

**Transition:** zoom out to the full window.

---

### Scene 11 - Working the way you like (8:55 - 9:25)

**Visual**
- 8:55 Toggle the theme button: light to dark; open the colour palette menu and change the primary colour.
- 9:05 Sidebar collapses to icons (burger button); resize the browser to show the mobile layout briefly.
- 9:12 Sign in with a non-operations user in a split frame: the menu has no **Request queue** and no Retry. Callout: "The menu follows your permissions."
- 9:20 Sign out.

**Screenshot assets**
- X: dark theme with the diagram.
- Y: sidebar of an operations user vs. a regular user, side by side.

**Voiceover**
> Light or dark, with the colours you prefer. And the menu only shows what your role allows, so people see exactly the tools they need, nothing more.

**Transition:** fade to the end card.

---

### Scene 12 - Close (9:25 - 9:40)

**Visual**
- 9:25 End card: product name, three bullets (**See** every instance on its diagram, **Find** what is stuck, **Fix** it safely), and the contact or documentation link.

**Voiceover**
> The BPM Operations Console: see every instance on its diagram, find what is stuck, and fix it safely. Thanks for watching.

---

## 3. Visual asset checklist

| ID | What to capture | Needs |
| --- | --- | --- |
| A | Dashboard with stat cards | Some non-zero counts |
| B | Sign-in page | - |
| C | Top bar with user and Operations tag | Operations user |
| D, E | Cards with red counts; failed steps table | Failed steps in the data |
| F, G, H | Instances filters, sorted table, paginator | A few hundred instances |
| I, J | Instance diagram and step side panel | Completed instance with running or failed step if possible |
| K, L, M, N | Step dialog: attributes, forms, queues, start form, service UUID | Instance with all four |
| O, P | Steps table with types and UUID | Service task present |
| Q, R, S | Attribute search, REC and TIMER row details | Timers present |
| T, U | Issues tab counts; process health | One process with 30 days of runs |
| V, W | Request queue and retry confirmation | Operations user, retryable status |
| X, Y | Dark theme; menus of two users | Two accounts |

---

## 4. Recording tips

- **Pace:** one idea per sentence; pause at each transition. Do not narrate every click; let the callouts do it.
- **Cursor:** use a highlighted cursor and a click ripple so viewers can follow.
- **Callouts:** keep them short (under eight words), bottom-left, same style throughout.
- **Cuts:** cut dead time while a list loads; never show an empty table in the final edit.
- **Captions:** burn in English captions from the voiceover text above.
- **Length:** if you need a short version (about 3 minutes), keep scenes 1, 3, 5, 6 and 12.
