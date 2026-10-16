---
name: shift-learning-governance
description: "Convert Shift run outcomes into durable Hermes/Engram learning and controlled skill-improvement proposals."
license: Apache-2.0
metadata:
  author: Shift
  version: "1.1"
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

## Self-evolution policy

Applies whenever Hermes changes its own skills or config (`hermes-bootstrap/`,
`docker/`, `scripts/`, `infra/`) or proposes a change to repo skills
(`.github/skills/`).

- Work on a branch named `chore/hermes-self-update/<short-description>`.
- Make small, coherent commits; every commit message ends with a `Risk:` line
  (tier plus the reason).
- Push the branch and open a PR against `main`. The PR description lists each
  changed contract (skill, config key, interface) and the reason for it.
- Never push to `main`. Never merge your own PR. Never use `--admin`.
- Repo-skill changes (`.github/skills/`) go in their own PR, separate from
  runtime or devops changes (`hermes-bootstrap/`, `docker/`, `scripts/`,
  `infra/`). Never mix either with a product issue PR.
- Before opening a PR that changes the supervisor's skills, do a no-change dry
  pass of the readiness -> planning cycle and confirm that every skill path
  resolves and every `recommendedSkill` value maps to a real file.
- After a merge, pull `origin/main` into `/workspace/shift`; Hermes loads these
  skills from that checkout (`skills.external_dirs`).
