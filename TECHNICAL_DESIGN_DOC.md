
# Cadence Desktop Ear Trainer – Comprehensive Technical Design Document

---

## 1 High‑Level Architecture

Cadence is a **single‑process Electron application** embedding a **Rust core engine** (via NAPI‑rs) and a **Python Langgraph runtime** (via PyO3). All time‑critical MIDI/audio work happens in Rust; Electron’s renderer threads manage UI. Inter‑layer boundaries (↓) are strictly message‑oriented to isolate GC pauses.

```
┌────────────┐    ipc   ┌────────────┐ FFI  ┌────────────┐
│Electron UI │◄────────►│ Node Bridge│◄────►│ Rust Core  │
└────────────┘          └────────────┘      │  + PyO3    │
     ▲     ▲             ▲        ▲         │  (Langgraph)
     │WebAudio           │        │         └────────────┘
     │(playback)         │SQLite   │MusicXML ↕
     ▼                   ▼        ▼
┌───────────────┐  ┌───────────┐  ┌────────────────┐
│FluidSynth/OS  │  │Analytics  │  │Sheet‑music svc │
└───────────────┘  └───────────┘  └────────────────┘
```

### 1.1 Rationale

- **Rust** guarantees real‑time safety for MIDI → audio pipeline.
    
- **Electron/React** shortens UI iteration and cross‑platform packaging.
    
- **Langgraph** provides reproducible, inspectable learning sessions without bespoke FSM code.
    

---

## 2 Component Breakdown

|ID|Component|Language|Threads|Key Responsibilities|
|---|---|---|---|---|
|C‑1|**UI Renderer** (React)|TS|1 per window|Draw drills, Notefall lanes, settings panels|
|C‑2|**Node Bridge**|TS/NAPI‑rs|1|Serialize IPC msgs, buffer MIDI events into Rust ring‑buffer|
|C‑3|**Core Engine**|Rust|2 (audio + logic)|Timestamp MIDI, quantize, schedule audio, expose FFI to Langgraph|
|C‑4|**Langgraph Runtime**|Py 3.11|1 (GIL)|Orchestrate exercise graph, update learner model|
|C‑5|**Persistence**|Rust sqlx|shared|CRUD user/score tables, WAL mode|
|C‑6|**Sheet‑Music Fetcher**|TS|async worker|Crawl IMSLP/Mutopia, MusicXML → JSON|
|C‑7|**Telemetry**|Rust|n/a|Local log, optional crash reporter|

---

## 3 Data Flow & Sequence Diagrams

### 3.1 Interval Drill (Happy Path)

```
sequenceDiagram
User→>UI: Select "Interval Drill"
UI→>Langgraph: start("interval", params)
Langgraph→>NodeBridge: prompt(C‑3)
NodeBridge→>Core: play(prompt notes)
Core-->>NodeBridge: prompt_id
User→>MIDI Keyboard: play answer
Core-->>Langgraph: answer(msg)
Langgraph-->>UI: feedback(correct/incorrect, Δt)
```

### 3.2 Metronome Accuracy Loop

1. UI schedules click track via NodeBridge.
    
2. Core’s audio thread emits metronome sample‑accurate ticks.
    
3. User keystrokes captured with timestamps.
    
4. Rust logic thread computes Δt, writes to SQLite.
    
5. React histogram component queries Δt and renders.
    

---

## 4 Module Interfaces

### 4.1 Rust ↔ Node (NAPI‑rs)

```
// midi_api.rs
pub struct MidiEvent { note: u8, velocity: u8, ts_nanos: u64 }
#[napi]
pub fn poll_midi(max: usize) -> Vec<MidiEvent>;

#[napi]
pub fn play_tone(note: u8, duration_ms: u32, velocity: u8);
```

### 4.2 Rust ↔ Python (PyO3)

```
#[pyfunction]
fn evaluate_interval(prompt: &IntervalPrompt, answer: &[u8]) -> Feedback { … }
```

---

## 5 Langgraph State Machine

```
with StateGraph(name="session") as sg:
    sg.add_state("generate", gen_prompt)
    sg.add_state("listen", listen_answer)
    sg.add_state("evaluate", eval_answer)
    sg.add_state("feedback", show_feedback)
    sg.add_edges({
        "generate": "listen",
        "listen": "evaluate",
        "evaluate": Conditional({
            correct: "generate",
            incorrect: "feedback"
        }),
        "feedback": "generate"
    })
```

- **Persistence**: each node commits its output to `session_log` table.
    
- **Hot‑reload**: graph definition re‑evaluated on file‑change in dev mode.
    

---

## 6 Data Model

```
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attempts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  drill_type TEXT,
  prompt_json TEXT,
  answer_json TEXT,
  correct BOOLEAN,
  latency_ms REAL,
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_ts ON attempts(user_id, ts DESC);
```

MusicXML import cached as gzipped blobs keyed by SHA‑256.

---

## 7 Concurrency Model

- **Audio Thread**: Real‑time priority, lock‑free ring buffers (crossbeam) for incoming events.
    
- **Logic Thread**: 60 Hz tick, pulls processed events, writes to SQLite.
    
- **Renderer Threads**: React refresh driven by requestAnimationFrame.
    
- IPC uses zeromq‑like back‑pressure: JSON lines over libuv pipes.
    

---

## 8 Performance Targets & Benchmarks

|   |   |   |
|---|---|---|
|Stage|Target|Method|
|MIDI in → Rust timestamp|≤ 1 ms|Audit cycle‑counts via `rdtsc`|
|Rust → React feedback render|≤ 16 ms|React Profiler flamegraphs|
|Notefall frame time @60 FPS|≤ 8 ms|Chrome perf‑hooks on Intel UHD 620|

Automated latency regression tests run in CI against synthetic MIDI streams.

---

## 9 Build, CI & Packaging

- **Repo**: monorepo (pnpm workspaces + Cargo).
    
- **CI**: GitHub Actions; matrix on win‑latest, macos‑14, ubuntu‑22.04.
    
- **Lint/Test**: `cargo clippy`, `pytest -q`, `vitest`.
    
- **Release**: `electron‑builder` → NSIS, dmg, AppImage.
    
- **Signing**: GitHub OIDC + Sigstore for Windows EV.
    

---

## 10 Security & Privacy

- All user drill data stored local; path `~/.cadence` (XDG dirs on Linux).
    
- Cryptographically‑signed auto‑updates (Squirrel). Public key pinned in app.
    
- Supply‑chain scanning via `cargo‑audit`, `npm audit`, `osv‑scanner`.
    

---

## 11 Testing Strategy

|   |   |
|---|---|
|Layer|Tools|
|Rust unit|`criterion` (bench), `proptest` (fuzz)|
|Py Langgraph|`pytest`, coverage 90 %+|
|Integration|Playwright + virtual MIDI|
|E2E Latency|Custom CLI harness replaying SMF files|

---

## 12 Internationalization & Accessibility

- All UI strings externalized to ICU JSON.
    
- High‑contrast color theme toggles.
    
- Screen‑reader labels via `aria‑live`.
    

---

## 13 Future‑Proofing

Interfaces keep JSON schema stable; new drill types are plugins discovered via package.json `cadence‑plugin` keyword, loaded in sandboxed Node VM.

---

## 14 Open Issues

1. VSync conflicts with real‑time thread priority on macOS.
    
2. FluidSynth vs native OS synth licensing differences.
    
3. How to sandbox arbitrary MusicXML to prevent path traversal.
    

---

## 15 Appendices

- **A**: Expected CPU & memory profile tables.
    
- **B**: PlantUML diagrams for Notefall renderer pipeline.
    
- **C**: Threat model STRIDE worksheet.
    

---

_End of Document_