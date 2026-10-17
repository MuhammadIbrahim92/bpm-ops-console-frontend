# Plan: open the tracking of a sub-process from its step

Goal: on an instance's diagram, clicking a sub-process step (a *CallSubProcess* activity) leads to the tracking page of
the instance it started: found from the process id and version configured in the XPDL, the parent instance id, and the
child that started nearest to the step's start time.

## 1. What the data says (checked on the live schema)

| Fact | Evidence |
|---|---|
| The XPDL names the sub-process | `<SubFlow Id="2649" PackageRef="Version 8" StartActivityId="Visit Confirmation_Activ1"/>` inside the activity's `Implementation`. 323 stored versions contain one. The parser does not read it yet (it only marks the node as `SUB_PROCESS`). |
| A child instance points at its parent | `EXC_PROCESS_INSTANCE.PARENT_PROCESS_INST_ID` is filled for 2,109 of 16,807 instances. |
| It also points at the exact step | `STOPPED_PARENT_ACTIVTY` holds the **parent's ACTIVITY_INSTANCE_ID** (not an activity id, despite the name): e.g. child 277940055 has 277939998, which is `FTTH_Activ82` of parent 277939916. The child's `CREATION_DATE` equals that step's `START_DATE` to the second. |
| The configured version is not always the version that ran | The XPDL says `Version 8` for process 2649, the children that actually ran are `Version 46`. So the id is a reliable key; the version is only a hint. |
| The link is often missing | Of 1,348 children whose parent id is set, the parent no longer exists (purged or archived). For sub-process steps that ran in the last 200 days: 172 of 298 completed and 49 of 114 running have a child linked by activity instance id; matching by parent instance id alone adds only a few (190 and 52). The rest have no child row at all. |
| No ambiguity seen | No two children of one parent share process id and creation time. |

So the user's approach (process id and version from the XPDL, parent instance id, nearest start time) is the right
fallback; the step id in `STOPPED_PARENT_ACTIVTY` is a stronger first choice and should be tried first.

## 2. How the child is found (one rule, tried in order)

For one execution of the sub-process step (an activity instance with id `A`, parent instance `P`, start time `T`):

1. **Exact.** A child with `PARENT_PROCESS_INST_ID = P` and `STOPPED_PARENT_ACTIVTY = A`.
2. **From the definition.** Children of `P` whose `PROCESS_ID` equals the XPDL `SubFlow Id`, not already claimed by
   another execution of a sub-process step of `P`; pick the one whose `CREATION_DATE` is nearest to `T` (and not before
   `T` minus a second). A child with the configured version wins a tie.
3. **Parent only.** Children of `P` not claimed, nearest to `T`, when the XPDL has no `SubFlow` (older definitions).
4. **None.** Say so, with the reason (parent has no child rows, or the definition names a process nothing started).

Every answer says how it was found (*exact*, *by process and time*, *by time only*) so a guess is never shown as
certain. Loops are handled per execution: each execution of the step gets its own child, and a child is used once.

## 3. Backend

1. **Read the SubFlow.** `DiagramParser` keeps `subProcessId`, `subProcessVersion`, `startActivityId` on the node
   (new nullable fields on `DiagramGraph.Node`; sent to the browser with the graph).
2. **Resolver.** New `SubProcessResolver` (pure, unit tested) implementing section 2 over plain records.
3. **Repository query.** One read per instance: all children of the instance
   (`PARENT_PROCESS_INST_ID = :id`: id, process id, version, status, creation, name, `STOPPED_PARENT_ACTIVTY`) and the
   instance's sub-process step executions (activity instances whose definition type is `CallSubProcess`).
4. **Endpoint.** `GET /api/instances/{id}/children` returns, per sub-process step execution:
   `{ activityId, activityInstanceId, child: { instanceId, processId, version, status, created, name } | null,
   matchedBy, note }`. Children the signed-in user may not see (same visibility rule as the instance list) come back as
   *"exists, not visible to you"* without details.
5. **Parent link on the child.** `InstanceSummary` gets `parentInstanceId` and `parentActivityInstanceId` (both
   already in the row). A matching `GET /api/instances/{id}/parent` gives the parent step's name for the breadcrumb;
   it says *"the parent instance no longer exists"* when it was purged.
6. Read-only, no new permission (same `VIEW_INSTANCES` and visibility as today).

## 4. Frontend

1. **On the diagram.** Sub-process steps with a child get a small "open" icon on their corner (from one call to the
   children endpoint when the diagram loads), so they can be found at a glance.
2. **On click.** The step popup (already opened by a click) gets a *Sub-process* section at the top: one row per
   execution with the child's id, status badge, version (and "configured: Version 8" when it differs), how it was
   matched, and an **Open tracking** button. A single child opens straight away on a double click.
3. **Open tracking** goes to `/instances/{child}` (the page that exists), keeping the parent in the history stack.
4. **On the child.** A banner "Sub-process of #parent, step *Name*" with a link back to the parent and to the exact
   step (selected on the parent's diagram). When the parent is gone: "The parent instance was purged".
5. **Follow the run / issues** on the parent can pass through the sub-process step and offer *Open tracking* from the
   same panel.

## 5. Edge cases and decisions

* Parent purged (about two thirds of the children rows): the child still opens, with the "parent gone" banner.
* Sub-process step ran but no child row exists (about a third): show "No child instance was recorded" rather than a
  guess; do not match children of other instances.
* Child of a different version than configured: shown, never hidden.
* Two executions of the step in a loop: matched one to one, nearest start first.
* Test instances and visibility: the child follows the same rules as any instance; a hidden child is not revealed.
* Steps that only call the sub-process through a timeout or terminate path: handled by the same rule, no special case.

## 6. Tests

* Resolver unit tests: exact match; fallback by process and time; configured version as tie-break; two executions in a
  loop; a child used only once; no child; no `SubFlow`.
* A parser test on a real `SubFlow` snippet.
* Live check on parent 277939916 (three children: processes 4367, 3830, 2649, each matched exactly by step id) and on a
  completed sub-process step with no child row (expects "none").
* Frontend: the popup section for one child, several executions, none, and "not visible".

## 7. Size

About two days: parser and resolver with tests (0.5), repository, endpoint and visibility (0.5), popup, badge and
banner (0.75), live checks and polish (0.25).

## 8. Questions before starting

1. When a child is only a time-based guess (rules 2 and 3), show it as "probable" with the Open button, or only show
   exact matches?
2. Open the child in the same tab (with a back link) or a new tab?
3. Should the parent's diagram also draw the sub-process step's own state from its child (for example "child failed")?
