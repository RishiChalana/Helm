# ADR 003 — Materiality filter on proactive insights

**Status:** Accepted

**Context:** Running the agent daily for every user and pushing every candidate insight would cause notification fatigue, making users mute or uninstall.

**Decision:** The daily APScheduler job generates insights only when both conditions hold: (1) the budget's actual pace deviates more than 15% above the expected pace for the day-of-month, AND (2) the projected end-of-month spend exceeds the limit by more than 20%. Insights that don't clear both thresholds are discarded — not stored, not pushed.

**Rationale for thresholds:** 15% pace deviation is large enough to be actionable but small enough to catch problems early. 20% projected overspend filters out noise from irregular but legitimate one-time purchases early in the month. These are initial values; they should be tuned against real user feedback.

**Consequences:** Some legitimate overspend patterns will be missed (false negatives). This is the preferred failure mode — missing one alert is better than alerting on every small variation.
