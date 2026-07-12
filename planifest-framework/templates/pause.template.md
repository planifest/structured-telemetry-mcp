---
phase: "{phase-id}"
active_task: "{short description of the task in progress at pause time}"
last_artifact: "{path to the last file written or action completed}"
---
# Pause Record - {feature-id}

**Paused:** {ISO-8601 datetime}
**Phase:** {phase-id} — {phase name}

## In-Progress State

{Free-text description of what was partially completed. Include:
- Which requirement or task was being worked on
- What steps were completed before pausing
- What steps remain to complete the task
- Any blockers or decisions that were pending
This section must be detailed enough for the orchestrator to reconstruct
full execution context on resume without re-reading prior conversation.}

## Resume Instructions

On next session start, the orchestrator will detect this file and open with:

```
{phase-id}: Resuming — {active_task}
```

After re-reading this file, continue from the in-progress state above.
Delete this file once the interrupted task has been re-engaged.
