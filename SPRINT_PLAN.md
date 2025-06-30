Cadence MVP — Six-Sprint Execution Plan (12 weeks)

    Cadence scope reminder
    Only MIDI-piano I/O, one-track exercises, no microphone, no audio DSP in v1. If a task below starts to exceed this, cut or defer—latency and core UX win every trade-off.

Sprint 0 (Week 0) — Project Kick-off & “Hello Note”
Goal	Deliverables	Owners	Risks/Mitigations
Boot the repo, pipelines, and runtime skeleton.	* Monorepo on GitHub (desktop UI, core, infra).
* CI: lint, unit test, signed build on main.
* “Hello Note” demo—press a MIDI key, log pitch/velocity, render in bare-bones window.	Lead Eng, Dev Ops	CI lag → keep pipeline under 2 min; drop fancy static analysis for now.
Decide tech stack spikes.	* Final decision notes on:
 • Electron + Vite vs TAURI
 • WebGL vs 2D canvas renderer
* Prototype commits for both.	Frontend 1, Frontend 2	Analysis paralysis ⇒ 3-day timebox per spike.
Sprint 1 (Weeks 1-2) — Low-Latency MIDI Core
Epics / Stories	Acceptance Criteria
Real-time MIDI ingestion module	≤ 2 ms internal queue delay on 4090-class host at 120 PPQ.
Note event canonicalizer	Note-on / off → (pitch, start ms, duration ms, velocity) objects with device jitter compensation.
Langgraph session FSM skeleton	Graph nodes for Warmup → Exercise → Feedback → NextExercise. Unit tests covering all transitions.
CI upgrades	Contract test harness that feeds MIDI fixtures, asserts state diagram output.

🔥 Kill criteria: If delay > 4 ms by Thu W2, revert to polling approach and freeze.
Sprint 2 (Weeks 3-4) — Exercise Engine + Adaptive Logic
Epics / Stories	Acceptance Criteria
Exercise DSL & loader	YAML/JSON defines prompt, target notes/chords, BPM. Parsed & validated at start-up.
Adaptive mastery model (Elo-style)	Given ≥ 30 attempts across at least 3 skills, predicted success within ±10 pp of observed.
Feedback algorithms	Pitch correctness, timing offset (ms & ticks), velocity variance → JSON feedback payload; unit tests with golden vectors.
State integration	Langgraph node Evaluate calls feedback, updates mastery, decides next exercise.

Risk: Elo may be too spiky with low attempts. Mitigation: floor K-factor at 8, decay after every 10 correct reps.
Sprint 3 (Weeks 5-6) — UI Layer v1
Epics / Stories	Acceptance Criteria
Notefall / “Guitar-Hero” renderer	60 fps, <5 ms frame budget on 1080p; color-blind safe defaults.
Exercise picker & progress pane	List & detail view driven by adaptive model.
Metronome (visual + MIDI click)	Click drift ≤ ±2 ms over 4 min run.
OSS sheet-music fetcher (stub)	Slash-command in input to fetch .musicxml into exercise list (network mocked until Sprint 5).

✳️ Decision gate: WebGL vs Canvas prototype performance side-by-side; lock renderer tech Friday W6.
Sprint 4 (Weeks 7-8) — Vertical Slice & Latency Hardening
Epics / Stories	Acceptance Criteria
Vertical slice scenario	User completes 10-exercise session end-to-end; total crash-free time ≥ 20 min.
Performance budget pass	Cold-start < 3 s, idle CPU < 5 %, GPU < 10 %.
Instrumentation	Structured logs + analytics events (Snowplow) behind env flag.
Security/Privacy	Local-only by default; no outbound traffic unless sheet-music fetch enabled. Snyk scan clean.

⚠️ Latencies not met → features freeze and commit engineers to profiling.
Sprint 5 (Weeks 9-10) — External Integrations & Installer
Epics / Stories	Acceptance Criteria
Sheet-music fetch live	Public domain catalog search, rate-limited (max 5 calls/min).
Auto-update channel	Delta updates via Sparkle or equivalent; signed macOS & Win packages.
Crash + Metrics dashboard	Grafana board with daily crash count, avg latency, mastery delta.
Alpha tester onboarding	Private download link, telemetry opt-in modal.
Sprint 6 (Weeks 11-12) — Stabilization & “Show the Thing”
Scope	Exit Criteria
Bug bash, docs, and UX paper-cuts	Open P0 bugs = 0; P1 ≤ 5; README enables fresh dev to build/run in <30 min.
Accessibility pass	Tab nav, screen-reader labels for core workflow, font scaling.
Release “MVP 0.1.0-alpha”	Signed installers, release notes, and 10 seeded exercises in repo.
Cross-Cutting Work Streams (run every sprint)
Stream	Definition of Done
Test coverage	≥ 75 % statements, ≥ 90 % on Langgraph transitions.
Code review discipline	< 24 h turnaround, two-reviewer rule on core modules.
Design critique	Weekly 60-min review; reject lipstick-on-pig fixes—only structural solutions.
People & Allocation
Role	FTE	Notes
Tech Lead (backend/ML)	1.0	Owns adaptive logic & Langgraph design.
Frontend/Graphics	1.0	Renderer, UI.
Full-stack generalist	1.0	Bridges gaps, CI/CD, packaging.
Product / UX	0.5	Copy, flows, instrumentation priorities.
QA / Automation	0.5	Test harnesses, crash triage.

    Capacity buffer: ~20 % reserved each sprint for emergent bugs and refactors. If we touch it before Thursday, cut scope immediately.

Success Metrics (MVP)

    Median note-on latency ≤ 10 ms (device→feedback render).

    Daily active test user retention (Week 2–4 of alpha) ≥ 40 %.

    Exercise completion rate ≥ 70 % of started sessions.

    Crash-free session ≥ 98 %.

Fail any two → MVP isn’t “viable”—break glass and re-scope before marketing spin-up.
Open Questions (track in backlog)

    Can we reuse open-source MusicXML renderers instead of custom parser?

    Is Sparkle acceptable for Windows code-signing, or do we need Squirrel?

    Do we seed fixed exercise sets or generate procedurally from intervals/chords?

    How do we keep future microphone input outside this code path to avoid tech debt?

Next step: Assign story points, drop into Kanban, and start Sprint 0 tomorrow 09:00 EDT—no further blockers.