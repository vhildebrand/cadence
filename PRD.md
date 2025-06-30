# Cadence Desktop Ear Trainer – MVP Product Requirements Document

## 1. Purpose & Vision

Cadence is a desktop application that delivers intelligent, data‑driven ear‑training for musicians. The MVP targets MIDI piano users, providing real‑time feedback on pitch recognition, rhythmic accuracy, and sight‑reading through a gamified interface. Langgraph orchestrates stateful learning sessions so drills, feedback, and adaptive difficulty remain deterministic and debuggable.

## 2. Goals

1. **Immediate, actionable feedback** on intervals, chords, scales, and rhythmic precision (≤ 30 ms end‑to‑end latency).
    
2. **Adaptive practice engine** that calibrates difficulty to user performance in under five sessions.
    
3. **Metronome accuracy trainer** with visual offset readout (±1 ms resolution).
    
4. **Public‑domain sheet‑music finder** (IMSLP, Mutopia) with one‑click import to Notefall view.
    
5. **Gamified "Notefall" mode** (Guitar‑Hero style) that overlays notes in scrolling lanes, scoring accuracy and timing.
    

## 3. Non‑Goals

- Microphone‑based pitch detection.
    
- Multi‑instrument support (beyond piano) in MVP.
    
- Full music‑notation editor or DAW features.
    

## 4. Target Audience & Personas

|Persona|Skill Level|Pain Point|Cadence Value|
|---|---|---|---|
|Alex (College piano major)|Intermediate|Needs daily interval drills without boring repetition|Adaptive interval trainer + sheet‑music import|
|Jordan (Adult hobbyist)|Beginner|Struggles to play in time|Metronome offset visualizer + gamified Notefall|
|Casey (Music‑ed teacher)|Intermediate|Wants sharable drills for students|Exportable exercise presets (post‑MVP)|

## 5. User Stories (MVP‑scope)

1. **Interval Drill** – "As a learner, I choose ‘Perfect Fifths’ drill, hear two notes, and press the correct interval button; the system instantly shows correct/incorrect and my streak."
    
2. **Rhythm Accuracy** – "As a learner, I enable metronome mode, play quarter notes at 90 BPM, and see a timeline displaying my ±ms deviations."
    
3. **Sight‑Reading Notefall** – "As a learner, I import Bach’s Prelude in C major and play along while scrolling note blocks indicate upcoming notes and turn green/red on correct/incorrect hits."
    
4. **Session Persistence** – "If Cadence crashes or I quit, next launch resumes the exact drill step with my last streak intact."
    

## 6. Functional Requirements

### 6.1 MIDI Input Layer

- Auto‑detect USB‑MIDI devices; hot‑plug support.
    
- Capture note‑on/off with timestamp precision ≤ 1 ms.
    

### 6.2 Exercise Engine

- **Drill Types**: Intervals, Chord Qualities, Scale Recognition, Rhythm Clapping (keyboard as trigger).
    
- **Adaptive Algorithm**: Elo‑like rating per drill; difficulty chosen via Bayesian Bandit.
    
- Metronome: Adjustable 40‑240 BPM, subdivision options (8th, 16th, triplet).
    

### 6.3 Feedback & UI

- Real‑time color overlay (green = correct, red = wrong, yellow = late/early).
    
- Metronome deviation histogram after each run.
    
- Notefall lanes (max 4 simultaneous voices in MVP).
    

### 6.4 Langgraph Session State

```
Idle → ExerciseSelect → GeneratePrompt → AwaitInput → Evaluate → Feedback → Log → Idle
```

- Transitions triggered by user actions or timeouts.
    
- State persisted to SQLite.
    
- Graph visualizer in dev‑tools mode.
    

### 6.5 Sheet‑Music Fetcher

- Query endpoints: IMSLP API, Mutopia RSS.
    
- Accept MusicXML; convert to internal Notefall JSON via open‑source lib (e.g., VexFlow converter).
    

### 6.6 Analytics & Telemetry

- Local log of drill results (timestamp, latency, accuracy) for progress charts.
    
- Opt‑in anonymized crash reports.
    

## 7. Non‑Functional Requirements

|   |   |
|---|---|
|Category|Requirement|
|Performance|≤ 30 ms feedback loop; CPU use ≤ 50 % of single core on typical laptop|
|Reliability|Crash‑free session rate ≥ 99 %|
|Cross‑Platform|Windows 10+, macOS 13+, Ubuntu 22.04 (x86_64)|
|Install Size|≤ 200 MB|
|Offline Mode|All drills & Notefall work offline; sheet‑music search disabled offline|
|Privacy|All user performance data stored locally; no cloud sync in MVP|

## 8. Tech Stack

- **Frontend**: Electron + React + Vite + Tailwind.
    
- **Core**: Rust for MIDI/audio timing; Python/ Langgraph embedded via PyO3 for state machine & adaptive algorithm.
    
- **Audio**: WebAudio (Electron) with optional FluidSynth.
    
- **Persistence**: SQLite (via sqlx) + JSON blobs for sheet‑music cache.
    

## 9. Success Metrics

1. **Day‑7 retention** ≥ 30 % among beta users.
    
2. **Median pitch‑accuracy improvement** ≥ 20 % after 4 weeks (self‑reported + telemetry).
    
3. **Crash‑free sessions per user** ≥ 50 before first crash.
    
4. **Latency** ≤ 30 ms on reference laptop (Intel i5‑8250U).
    

## 10. Risks & Mitigations

|   |   |   |   |
|---|---|---|---|
|Risk|Impact|Likelihood|Mitigation|
|MIDI latency too high on Windows|Poor UX|Medium|Use native WinMM and RTT test harness; publish recommended drivers|
|OSS sheet‑music licenses unclear|Legal|Low|Filter by public‑domain year; link to source|
|Langgraph integration complexity|Schedule|Medium|Build thin wrapper; stub graph early in sprint|

## 11. Open Questions

1. Do we bundle a GM soundfont or rely on OS synth?
    
2. Should adaptive algorithm weight rhythm and pitch separately?
    
3. Minimum viable UI for visually‑impaired users?
    
4. Can Notefall mode reuse WebGL shaders from open‑source clones?
    

## 12. MVP Timeline (8‑Week Sprint)

|   |   |
|---|---|
|Week|Milestone|
|0–1|Architectural spike; MIDI input prototype; select Rust + Electron IPC|
|2|Interval drill implementation + basic Langgraph state loop|
|3|Metronome trainer; latency logging|
|4|Adaptive difficulty algorithm; local persistence|
|5|Notefall renderer (simplified lane view)|
|6|OSS sheet‑music import pipeline|
|7|QA + usability testing; crash telemetry|
|8|Beta packaging (NSIS, dmg, AppImage) + doc|

## 13. Post‑MVP Backlog

- Microphone pitch‑tracking for acoustic instruments.
    
- Multi‑instrument MIDI profiles (drums, guitar controllers).
    
- Teacher dashboard with assignment sharing.
    
- Mobile companion app for quick drills.
    

---

### Critical Path

Latency optimisation and Langgraph integration must be proven by Week 3; slipping here jeopardises core value proposition.

### Dependencies

- IMSLP public API reliability.
    
- Langgraph Python package stability.
    

---
