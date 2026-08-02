---
name: shift-learning-governance
description: "Convert Shift run outcomes into durable Hermes/Engram learning and controlled skill-improvement proposals."
license: Apache-2.0
metadata:
  author: Shift
  version: "1.0"
  hermes:
    tags: ["shift", "learning", "memory", "skills"]
---

# Learning governance

Use after every Shift autonomous cycle.

Classify each observation as:
- environment fact;
- project fact;
- one-off failure;
- recurring failure pattern;
- workflow defect;
- skill defect;
- analyzer misclassification;
- successful protective control.

Persist:
- concise environment/workflow facts to Hermes memory;
- detailed project knowledge to Engram;
- reusable procedures as Hermes skills.

Do not silently edit repo-local Shift skills. For proposed repo-skill changes,
record:
- evidence;
- recurrence count;
- root cause;
- exact target section;
- proposed wording or contract change;
- expected improvement;
- validation plan;
- rollback path.

Open a dedicated PR only when the change is high-confidence and reviewable.
Never mix self-modification with a product issue PR.
