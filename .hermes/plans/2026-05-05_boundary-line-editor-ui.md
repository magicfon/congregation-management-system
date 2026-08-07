# Boundary Line Editor UI Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Main orchestrator stays on GPT-5.5 for planning/review only; implementation/review workers should run via delegation on GLM-5.1.

**Goal:** Add a boundary-line editing workflow so cHinL can manually repair green divider lines, then regenerate polygon previews from the edited line network.

**Architecture:** Keep detected boundary lines as the source of truth. Store original generated lines read-only, apply manual edits as a separate overlay/state, export an edited line JSON, then polygonize from edited lines. Do not directly hand-edit 89 polygons as the primary workflow.

**Tech Stack:** Static Canvas editor in `public/tools/area-marker.html`, compact line JSON under `public/maps/generated/`, Python polygonize scripts in `scripts/`, validation via browser console + Node syntax check + JSON parsing.

---

## Agent Roles

### Agent A — Repo/UI inspector
- Model: GLM-5.1 worker
- Purpose: Inspect existing `area-marker.html` state/functions and identify exact insertion points.
- No file modifications.

### Agent B — Boundary data model implementer
- Model: GLM-5.1 worker
- Purpose: Add in-memory state for editable boundary lines, endpoints, selection, edits log, and export/import format.
- Modifies only `public/tools/area-marker.html` unless explicitly approved.

### Agent C — Boundary editor UI implementer
- Model: GLM-5.1 worker
- Purpose: Add toolbar controls, mode switch, selected line panel, endpoint display, and click/drag interaction.
- Modifies only `public/tools/area-marker.html`.

### Agent D — Edited-line export + polygonize integration
- Model: GLM-5.1 worker
- Purpose: Add export JSON and a script path for polygonizing edited line JSON into preview areas.
- May modify `scripts/polygonize-boundary-lines.py` or create a small wrapper script if needed.

### Agent E — Spec reviewer
- Model: GLM-5.1 worker
- Purpose: Review each task against acceptance criteria.
- No modifications.

### Agent F — Quality reviewer
- Model: GLM-5.1 worker
- Purpose: Check maintainability, coordinate correctness, UI safety, and no regression to existing overlays.
- No modifications.

### Orchestrator — GPT-5.5
- Purpose: Keep task order, resolve ambiguity, run final verification, summarize to cHinL.
- Must not read large diffs/logs directly; ask workers for concise structured summaries.

---

## Phase 0 — Pre-flight / guardrails

### Task 0.1: Verify delegation model

**Objective:** Ensure workers are actually GLM-5.1 before executing.

**Agent:** Orchestrator runs a tiny `delegate_task` smoke test.

**Verification:** Delegate result reports `model: glm-5.1`.

---

### Task 0.2: Snapshot current work

**Objective:** Record current git status before editing.

**Agent:** Orchestrator via terminal.

**Commands:**
```bash
git status --short
git diff --stat
```

**Verification:** Existing modified/untracked files are known. Do not commit yet unless cHinL approves.

---

## Phase 1 — Data model for editable boundary lines

### Task 1.1: Inspect current boundary overlay implementation

**Objective:** Find exact current functions/state related to boundary line overlay.

**Agent:** Agent A.

**Files:**
- Read: `public/tools/area-marker.html`
- Read: `public/maps/generated/nanzih-boundary-lines-simplified-v3.json`

**Output:**
- Current state variable names
- Draw function insertion points
- Existing layer visibility structure
- Existing canvas event handlers
- Risks/conflicts

**No modifications.**

---

### Task 1.2: Add editable boundary state

**Objective:** Add state structures without changing behavior yet.

**Agent:** Agent B.

**Files:**
- Modify: `public/tools/area-marker.html`

**Add state conceptually:**
```js
let boundaryEditMode = false;
let editableBoundaryLines = null; // cloned from loaded compact JSON
let boundaryEditLog = {
  disabledLines: [],
  movedPoints: [],
  addedLines: [],
  connectedEndpoints: [],
  splitLines: []
};
let selectedBoundaryLine = null; // { lineIndex }
let selectedBoundaryPoint = null; // { lineIndex, pointIndex }
let boundaryEndpoints = [];
let showBoundaryEndpoints = true;
```

**Acceptance:**
- Existing boundary overlay still works.
- No UI visible change required yet.
- No JS syntax errors.

**Validation:**
```bash
node --check /tmp/extracted-area-marker-inline.js
```

---

### Task 1.3: Clone boundary overlay into editable line layer

**Objective:** After loading green boundary overlay, create an editable copy for boundary-edit mode.

**Agent:** Agent B.

**Behavior:**
- Original loaded overlay remains read-only.
- Editable copy is separate from original.
- If user clears/reloads map, editable state resets.

**Acceptance:**
- `editableBoundaryLines.lines.length` equals original `lineCount` after clone.
- Original JSON object is not mutated when editable line points change.

---

## Phase 2 — Visual editing UI MVP

### Task 2.1: Add Boundary Line Edit mode button

**Objective:** Add toolbar button `🧭 分界線編輯`.

**Agent:** Agent C.

**Files:**
- Modify: `public/tools/area-marker.html`

**Behavior:**
- Clicking button toggles boundary edit mode.
- In edit mode:
  - show green editable lines
  - show red endpoints
  - hide old areas/labels/legacy virtual boundary by default
- Exiting mode restores normal controls but does not delete edits.

**Acceptance:**
- Button active state visible.
- No regression to existing browse/add/edit modes.

---

### Task 2.2: Draw editable lines and endpoints

**Objective:** Render editable boundary lines with distinct editing affordances.

**Agent:** Agent C.

**Rendering:**
- Normal line: green
- Selected line: yellow, thicker
- Endpoint: red circle
- Selected point: white/yellow circle
- Added/manual line: cyan or orange

**Acceptance:**
- Endpoints visible only in boundary edit mode or when endpoint toggle is on.
- Stroke width scales with zoom: `screenWidth / zoom`.
- Canvas uses original image pixel coordinates directly.

---

### Task 2.3: Select nearest boundary line / point

**Objective:** Allow clicking near a line or endpoint to select it.

**Agent:** Agent C.

**Behavior:**
- Click near endpoint selects endpoint.
- Click near segment selects line.
- Selection panel shows:
  - line index
  - point count
  - start/end coordinates
  - length estimate

**Acceptance:**
- Selection does not interfere with existing area selection outside boundary edit mode.
- Nearest-hit tolerance is screen-space aware: e.g. `8 / zoom`.

---

### Task 2.4: Drag selected boundary point

**Objective:** Allow manual point adjustment.

**Agent:** Agent C.

**Behavior:**
- Drag selected point to new coordinate.
- Record edit in `boundaryEditLog.movedPoints`.
- Redraw immediately.

**Acceptance:**
- Point movement persists in current session.
- Original boundary overlay data is unchanged.
- Undo is optional for MVP; log must be exportable.

---

### Task 2.5: Connect two endpoints

**Objective:** Allow user to click two red endpoints and create a connecting line.

**Agent:** Agent C.

**Behavior:**
- First endpoint click marks source.
- Second endpoint click creates `addedLines.push([[x1,y1],[x2,y2]])` or a new line in editable layer.
- Store in `boundaryEditLog.connectedEndpoints`.

**Acceptance:**
- New line is visually distinct.
- Can be exported.
- No automatic polygon replacement yet.

---

### Task 2.6: Disable/delete selected line

**Objective:** Allow hiding/removing erroneous line segments from edited network.

**Agent:** Agent C.

**Behavior:**
- Button: `停用選取線段`.
- Adds line index to `disabledLines`.
- Disabled line is drawn gray or hidden depending toggle.

**Acceptance:**
- Disabled line is excluded from edited export.
- Can still be restored in session if simple undo/restore button is feasible.

---

## Phase 3 — Export edited boundary lines

### Task 3.1: Export edited boundary JSON

**Objective:** Add a button to export current edited line network.

**Agent:** Agent B or D.

**Output filename suggestion:**
- `nanzih-boundary-lines-edited-v1.json`

**Format:**
```json
{
  "version": 1,
  "mapId": "nanzih",
  "source": "nanzih-boundary-lines-simplified-v3.json",
  "imageSize": [7884, 5512],
  "units": "px",
  "encoding": "polyline-xy-array",
  "lineCount": 0,
  "pointCount": 0,
  "editLog": {},
  "lines": []
}
```

**Acceptance:**
- Exported JSON parses.
- Disabled lines are excluded.
- Added/connected lines are included.
- Coordinates remain `[x,y]` for boundary lines.

---

### Task 3.2: Import edited boundary JSON

**Objective:** Allow loading a previously exported edited boundary JSON.

**Agent:** Agent B or D.

**Behavior:**
- Local file input is OK for MVP.
- Loaded edited JSON replaces editable line layer, not original generated overlay.

**Acceptance:**
- Can export then import round-trip without count/coordinate changes.

---

## Phase 4 — Regenerate polygon preview from edited lines

### Task 4.1: Inspect current polygonize script input assumptions

**Objective:** Determine how `scripts/polygonize-boundary-lines.py` currently consumes masks/lines and what minimal change is needed to consume edited compact line JSON.

**Agent:** Agent D.

**Files:**
- Read: `scripts/polygonize-boundary-lines.py`
- Read: `scripts/vectorize-boundaries.py`

**No modifications in this task.**

---

### Task 4.2: Add CLI path to polygonize from compact line JSON

**Objective:** Let script consume edited line JSON and output polygon preview.

**Agent:** Agent D.

**Command target:**
```bash
. .venv-boundaries/bin/activate
python3 scripts/polygonize-boundary-lines.py \
  --input-lines public/maps/generated/nanzih-boundary-lines-edited-v1.json \
  --map-id nanzih \
  --reference-areas public/maps/nanzih-areas-cv2.json \
  --output-dir public/maps/generated \
  --version-suffix edited-v1
```

**Acceptance:**
- Outputs JSON preview and report.
- Preview JSON remains `[y,x]` for area-marker polygon loading.
- Reports expected vs actual area count.

---

### Task 4.3: Add UI instruction/export handoff

**Objective:** Since browser cannot directly run Python, UI should clearly tell user where exported edited JSON goes and what command to run, unless server-side endpoint is added later.

**Agent:** Agent C.

**Behavior:**
- After export, show command snippet or filename hint.
- Optional: button `載入 edited-v1 polygon preview` if output file exists.

**Acceptance:**
- Manual workflow is clear.
- No fake server action button that cannot work.

---

## Phase 5 — Verification and review gates

### Task 5.1: Automated static validation

**Agent:** Orchestrator or Agent E.

**Checks:**
- Extract inline JS from `area-marker.html` and run `node --check`.
- Parse generated compact JSON files.
- Parse any exported edited JSON sample.

---

### Task 5.2: Browser smoke test

**Agent:** Orchestrator using browser tool.

**Checks:**
- Open local test URL.
- Load 楠梓 map.
- Enter `分界線編輯` mode.
- Confirm endpoints visible.
- Select a line.
- Drag one point.
- Connect two endpoints.
- Export JSON.
- Console has no JS errors.

---

### Task 5.3: Spec review

**Agent:** Agent E.

**Output:**
- Verdict: PASS / REQUEST_CHANGES
- Missing acceptance criteria
- Critical issues only

---

### Task 5.4: Quality review

**Agent:** Agent F.

**Review dimensions:**
- Coordinate correctness `[x,y]` vs `[y,x]`
- No mutation of original overlay
- Editing mode isolation
- Canvas performance on 7884x5512 map
- No accidental overwrite of Supabase/cloud saved areas

---

## Recommended execution order

1. Phase 0: smoke-test worker + snapshot git status.
2. Task 1.1: inspect insertion points.
3. Task 1.2 + 1.3: editable state and clone.
4. Spec review for Phase 1.
5. Task 2.1 + 2.2: edit mode + rendering endpoints.
6. Browser smoke test.
7. Task 2.3 + 2.4: selection + drag point.
8. Task 2.5 + 2.6: connect endpoints + disable line.
9. Spec + quality review for Phase 2.
10. Task 3.1 + 3.2: export/import edited line JSON.
11. Browser export/import round-trip test.
12. Task 4.1 + 4.2: polygonize edited compact lines.
13. Task 4.3: UI handoff for regenerate preview.
14. Final browser smoke test + static validation.
15. Final review by Agent E/F.
16. Orchestrator summarizes changed files, test URL, caveats, and commit recommendation.

## Commit strategy

Only commit after cHinL approves. Suggested commits:

1. `feat: add boundary line editor state and UI`
2. `feat: support edited boundary line export/import`
3. `feat: polygonize edited boundary lines`

Generated artifacts under `public/maps/generated/` should not be committed unless cHinL explicitly wants them deployed.
