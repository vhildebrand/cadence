#!/usr/bin/env python3
"""
Cadence LangGraph Implementation
Basic interval drill state machine using LangGraph
"""

import json
import sys
import random
from typing import TypedDict, List, Dict, Any, Literal
from dataclasses import dataclass

# Try to import langgraph, fall back to basic implementation if not available
try:
    from langgraph.graph import StateGraph, START, END
    from langgraph.graph.message import AnyMessage
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    print("Warning: LangGraph not installed. Using basic implementation.", file=sys.stderr)

# Define the drill state structure
class DrillState(TypedDict):
    """State structure for the drill session"""
    current_drill: str
    prompt: str
    expected_notes: List[int]
    user_answer: List[int]
    score: int
    streak: int
    feedback: str
    is_complete: bool
    session_id: str

# Note mappings for interval drills
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def note_name_to_number(note_name: str, octave: int = 4) -> int:
    """Convert note name and octave to MIDI note number"""
    base_note = NOTE_NAMES.index(note_name)
    return (octave + 1) * 12 + base_note

def note_number_to_name(note_number: int) -> str:
    """Convert MIDI note number to note name with octave"""
    octave = note_number // 12 - 1
    note_name = NOTE_NAMES[note_number % 12]
    return f"{note_name}{octave}"

# Interval definitions (in semitones)
INTERVALS = {
    "Perfect Unison": 0,
    "Minor Second": 1,
    "Major Second": 2,
    "Minor Third": 3,
    "Major Third": 4,
    "Perfect Fourth": 5,
    "Tritone": 6,
    "Perfect Fifth": 7,
    "Minor Sixth": 8,
    "Major Sixth": 9,
    "Minor Seventh": 10,
    "Major Seventh": 11,
    "Perfect Octave": 12
}

def generate_prompt(state: DrillState) -> DrillState:
    """Generate a new interval drill prompt"""
    # For MVP, we'll focus on common intervals
    common_intervals = ["Perfect Fifth", "Major Third", "Perfect Fourth", "Major Second"]
    
    # Choose a random interval
    interval_name = random.choice(common_intervals)
    interval_semitones = INTERVALS[interval_name]
    
    # Choose a random root note (C4 to C6 range for playability)
    root_note = random.randint(60, 84)  # C4 to C6
    target_note = root_note + interval_semitones
    
    # Ensure target note is in reasonable range
    if target_note > 96:  # Above C7
        root_note = 96 - interval_semitones
        target_note = root_note + interval_semitones
    
    prompt_text = f"Play a {interval_name} starting from {note_number_to_name(root_note)}"
    
    # Update state
    new_state = state.copy()
    new_state.update({
        "current_drill": "interval",
        "prompt": prompt_text,
        "expected_notes": [root_note, target_note],
        "user_answer": [],
        "feedback": "",
        "is_complete": False
    })
    
    return new_state

def evaluate_answer(state: DrillState) -> DrillState:
    """Evaluate the user's answer against the expected notes"""
    expected = set(state["expected_notes"])
    user_answer = set(state["user_answer"])
    
    new_state = state.copy()
    
    # Check if the answer is correct
    if user_answer == expected:
        new_state["feedback"] = f"✅ Correct! You played {', '.join(note_number_to_name(n) for n in state['expected_notes'])}"
        new_state["score"] += 10
        new_state["streak"] += 1
    elif len(user_answer) == 0:
        new_state["feedback"] = "❌ No notes played. Try again!"
    elif len(user_answer) != len(expected):
        new_state["feedback"] = f"❌ Wrong number of notes. Expected {len(expected)}, got {len(user_answer)}"
        new_state["streak"] = 0
    else:
        # Wrong notes
        expected_names = [note_number_to_name(n) for n in state["expected_notes"]]
        user_names = [note_number_to_name(n) for n in state["user_answer"]]
        new_state["feedback"] = f"❌ Incorrect. Expected: {', '.join(expected_names)}, Got: {', '.join(user_names)}"
        new_state["streak"] = 0
    
    new_state["is_complete"] = True
    return new_state

class CadenceDrillGraph:
    """Simple drill graph implementation"""
    
    def __init__(self):
        self.state = DrillState(
            current_drill="",
            prompt="",
            expected_notes=[],
            user_answer=[],
            score=0,
            streak=0,
            feedback="",
            is_complete=False,
            session_id=f"session_{random.randint(1000, 9999)}"
        )
    
    def start_drill(self) -> Dict[str, Any]:
        """Start a new drill"""
        self.state = generate_prompt(self.state)
        return {
            "prompt": self.state["prompt"],
            "expected_notes": self.state["expected_notes"],
            "score": self.state["score"],
            "streak": self.state["streak"]
        }
    
    def evaluate_answer(self, user_answer: List[int]) -> Dict[str, Any]:
        """Evaluate user's answer"""
        self.state["user_answer"] = user_answer
        self.state = evaluate_answer(self.state)
        
        return {
            "feedback": self.state["feedback"],
            "score": self.state["score"],
            "streak": self.state["streak"],
            "is_complete": self.state["is_complete"]
        }

def create_langgraph_graph():
    """Create the LangGraph state machine (if LangGraph is available)"""
    if not LANGGRAPH_AVAILABLE:
        return None
    
    # Create the graph
    workflow = StateGraph(DrillState)
    
    # Add nodes
    workflow.add_node("generate_prompt", generate_prompt)
    workflow.add_node("evaluate_answer", evaluate_answer)
    
    # Add edges
    workflow.add_edge(START, "generate_prompt")
    workflow.add_edge("generate_prompt", "evaluate_answer")
    workflow.add_edge("evaluate_answer", END)
    
    # Compile the graph
    return workflow.compile()

def main():
    """Main function to handle command line execution"""
    if len(sys.argv) < 2:
        print("Usage: python cadence_graph.py <command> [args]")
        print("Commands:")
        print("  start_drill - Start a new interval drill")
        print("  evaluate_answer <json_data> - Evaluate user's answer")
        return
    
    command = sys.argv[1]
    
    # Create drill graph instance
    drill_graph = CadenceDrillGraph()
    
    if command == "start_drill":
        result = drill_graph.start_drill()
        print(json.dumps(result))
    
    elif command == "evaluate_answer":
        if len(sys.argv) < 3:
            print("Error: evaluate_answer requires JSON data")
            return
        
        try:
            evaluation_data = json.loads(sys.argv[2])
            expected_notes = evaluation_data.get("expected_notes", [])
            user_answer = evaluation_data.get("user_answer", [])
            current_score = evaluation_data.get("current_score", 0)
            current_streak = evaluation_data.get("current_streak", 0)
            
            # Update drill state
            drill_graph.state["expected_notes"] = expected_notes
            drill_graph.state["score"] = current_score
            drill_graph.state["streak"] = current_streak
            
            result = drill_graph.evaluate_answer(user_answer)
            print(json.dumps(result))
            
        except json.JSONDecodeError:
            print("Error: Invalid JSON data")
    
    elif command == "demo":
        # Demo mode - run a complete drill cycle
        print("=== Cadence Drill Demo ===")
        
        # Start drill
        drill_result = drill_graph.start_drill()
        print(f"Prompt: {drill_result['prompt']}")
        print(f"Expected notes: {[note_number_to_name(n) for n in drill_result['expected_notes']]}")
        
        # Simulate user input (for demo purposes)
        user_input = drill_result['expected_notes']  # Simulate correct answer
        print(f"User plays: {[note_number_to_name(n) for n in user_input]}")
        
        # Evaluate
        evaluation_result = drill_graph.evaluate_answer(user_input)
        print(f"Feedback: {evaluation_result['feedback']}")
        print(f"Score: {evaluation_result['score']}")
        print(f"Streak: {evaluation_result['streak']}")
    
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main() 