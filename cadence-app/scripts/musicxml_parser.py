#!/usr/bin/env python3
"""
MusicXML Parser for Cadence Notefall Game
Parses MusicXML files to extract notes, timing, duration, and measures
"""

import sys
import json
import os
from music21 import stream, converter, note, chord, meter, tempo, key, scale
from music21.note import Rest
from typing import List, Dict, Any, Optional, Tuple

class MusicXMLParser:
    def __init__(self):
        self.score = None
        self.tempo_bpm = 120  # Default tempo
        self.time_signature = (4, 4)  # Default time signature
        self.key_signature = None
        self.parsed_data = {
            'notes': [],
            'measures': [],
            'tempo': 120,
            'time_signature': [4, 4],
            'key_signature': None,
            'total_duration': 0,
            'metadata': {}
        }
    
    def parse_file(self, file_path: str) -> Dict[str, Any]:
        """Parse a MusicXML file and return structured data"""
        try:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")
            
            # Load the MusicXML file
            self.score = converter.parse(file_path)
            
            # Extract metadata
            self._extract_metadata()
            
            # Extract musical elements
            self._extract_tempo_and_time_signature()
            self._extract_key_signature()
            self._extract_notes_and_timing()
            self._extract_measures()
            
            return self.parsed_data
            
        except Exception as e:
            raise Exception(f"Error parsing MusicXML file: {str(e)}")
    
    def _extract_metadata(self):
        """Extract metadata from the score"""
        metadata = {}
        if hasattr(self.score, 'metadata') and self.score.metadata:
            metadata['title'] = self.score.metadata.title or "Unknown"
            metadata['composer'] = self.score.metadata.composer or "Unknown"
            metadata['copyright'] = self.score.metadata.copyright or ""
        
        self.parsed_data['metadata'] = metadata
    
    def _extract_tempo_and_time_signature(self):
        mm = next(self.score.recurse().getElementsByClass(tempo.MetronomeMark), None)
        if mm:
            self.tempo_bpm = mm.getQuarterBPM()
        ts = next(self.score.recurse().getElementsByClass(meter.TimeSignature), None)
        if ts:
            self.time_signature = (ts.numerator, ts.denominator)
        self.parsed_data['tempo'] = self.tempo_bpm
        self.parsed_data['time_signature'] = list(self.time_signature)

    
    def _extract_key_signature(self):
        """Extract key signature information"""
        key_sigs = self.score.recurse().getElementsByClass(key.KeySignature)
        if key_sigs:
            key_sig = key_sigs[0]
            self.key_signature = {
                'sharps': key_sig.sharps,
                'name': str(key_sig)
            }
            
            # Try to get mode from Key objects if available
            key_objects = self.score.recurse().getElementsByClass(key.Key)
            if key_objects:
                key_obj = key_objects[0]
                self.key_signature['mode'] = key_obj.mode
            else:
                # Default to major if no Key object found
                self.key_signature['mode'] = 'major'
        
        self.parsed_data['key_signature'] = self.key_signature
    
    def _extract_notes_and_timing(self):
        """Populate self.parsed_data['notes'] with absolute timing for every note.

        Using ``Stream.flat`` ensures that all offsets are expressed relative to the
        *beginning of the score* (rather than to the containing Measure or Voice).
        This prevents the problem where many notes share an offset of ``0`` because
        <backup> or multiple voices reset the local cursor inside a measure.
        """

        notes_data = []

        for part in self.score.parts:  # Iterate over each part/staff independently
            flat_stream = part.flat   # "flatten" resolves measures/voices into one timeline

            for el in flat_stream.notesAndRests:
                start_q = float(el.offset)  # Already absolute within the part
                dur_q   = float(el.duration.quarterLength)

                timing = {
                    'start_time_quarters': start_q,
                    'duration_quarters':   dur_q,
                    'start_time_seconds':  self._quarter_length_to_seconds(start_q),
                    'duration_seconds':    self._quarter_length_to_seconds(dur_q),
                    'measure_number':      (el.getContextByClass(stream.Measure).number
                                            if el.getContextByClass(stream.Measure) else None)
                }

                if isinstance(el, note.Note):
                    notes_data.append(self._create_note_data(el, timing))
                elif isinstance(el, chord.Chord):
                    for p in el.pitches:
                        notes_data.append(self._create_chord_note_data(el, p, timing))
                else:  # Rest
                    notes_data.append(self._create_rest_data(el, timing))

        # Sort notes by their absolute start time to guarantee chronological order
        notes_data.sort(key=lambda n: n['start_time_seconds'])

        self.parsed_data['notes'] = notes_data
        self.parsed_data['total_duration'] = (
            max(
                (n['start_time_seconds'] + n['duration_seconds'] for n in notes_data),
                default=0.0,
            )
        )
    
    def _get_element_timing(self, element, current_time: float) -> Dict[str, Any]:
        """Get timing information for a musical element"""
        quarter_length = element.duration.quarterLength
        duration_seconds = self._quarter_length_to_seconds(quarter_length)
        start_time_seconds = self._quarter_length_to_seconds(current_time)
        
        return {
            'start_time_quarters': current_time,
            'duration_quarters': quarter_length,
            'start_time_seconds': start_time_seconds,
            'duration_seconds': duration_seconds,
            'measure_number': element.measureNumber if hasattr(element, 'measureNumber') else None
        }
    
    def _create_note_data(self, note_obj: note.Note, timing_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create note data dictionary for a single note"""
        return {
            'type': 'note',
            'pitch': note_obj.pitch.name,
            'octave': note_obj.pitch.octave,
            'midi_number': note_obj.pitch.midi,
            'frequency': note_obj.pitch.frequency,
            'duration_quarters': timing_data['duration_quarters'],
            'duration_seconds': timing_data['duration_seconds'],
            'start_time_quarters': timing_data['start_time_quarters'],
            'start_time_seconds': timing_data['start_time_seconds'],
            'measure_number': timing_data['measure_number'],
            'velocity': getattr(note_obj, 'velocity', 64),  # Default MIDI velocity
            'articulation': [str(art) for art in note_obj.articulations] if note_obj.articulations else []
        }
    
    def _create_chord_note_data(self, chord_obj: chord.Chord, pitch, timing_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create note data dictionary for a note within a chord"""
        return {
            'type': 'chord_note',
            'pitch': pitch.name,
            'octave': pitch.octave,
            'midi_number': pitch.midi,
            'frequency': pitch.frequency,
            'duration_quarters': timing_data['duration_quarters'],
            'duration_seconds': timing_data['duration_seconds'],
            'start_time_quarters': timing_data['start_time_quarters'],
            'start_time_seconds': timing_data['start_time_seconds'],
            'measure_number': timing_data['measure_number'],
            'velocity': getattr(chord_obj, 'velocity', 64),
            'chord_root': chord_obj.root().name if chord_obj.root() else None,
            'chord_quality': chord_obj.quality if hasattr(chord_obj, 'quality') else None
        }
    
    def _create_rest_data(self, rest_obj: Rest, timing_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create rest data dictionary"""
        return {
            'type': 'rest',
            'duration_quarters': timing_data['duration_quarters'],
            'duration_seconds': timing_data['duration_seconds'],
            'start_time_quarters': timing_data['start_time_quarters'],
            'start_time_seconds': timing_data['start_time_seconds'],
            'measure_number': timing_data['measure_number']
        }
    
    def _extract_measures(self):
        measures_data = []
        for m in self.score.parts[0].getElementsByClass(stream.Measure):
            ts = m.timeSignature
            ks = m.keySignature
            tempo_mark = next(m.recurse().getElementsByClass(tempo.MetronomeMark), None)
            measures_data.append({
                'number': m.number,
                'start_time_quarters': m.offset,
                'start_time_seconds': self._quarter_length_to_seconds(m.offset),
                'duration_quarters': ts.barDuration.quarterLength if ts else None,
                'duration_seconds': (self._quarter_length_to_seconds(ts.barDuration.quarterLength)
                                    if ts else None),
                'time_signature': [ts.numerator, ts.denominator] if ts else None,
                'key_signature': {'sharps': ks.sharps, 'name': str(ks)} if ks else None,
                'tempo': tempo_mark.getQuarterBPM() if tempo_mark else None,
                'notes_count': len(m.notes)
            })
        self.parsed_data['measures'] = measures_data
    
    def _quarter_length_to_seconds(self, quarter_length: float) -> float:
        """Convert quarter note lengths to seconds based on tempo"""
        # 60 seconds per minute / tempo (quarter notes per minute) * quarter_length
        return (60.0 / self.tempo_bpm) * quarter_length
    
    def get_notes_for_range(self, start_seconds: float = 0, end_seconds: float = None) -> List[Dict[str, Any]]:
        """Get notes within a specific time range"""
        if end_seconds is None:
            end_seconds = self.parsed_data['total_duration']
        
        filtered_notes = []
        for note_data in self.parsed_data['notes']:
            note_start = note_data['start_time_seconds']
            note_end = note_start + note_data['duration_seconds']
            
            # Include notes that overlap with the time range
            if note_start < end_seconds and note_end > start_seconds:
                filtered_notes.append(note_data)
        
        return filtered_notes
    
    def get_midi_notes_for_game(self) -> List[Dict[str, Any]]:
        """Get notes formatted for the Notefall game"""
        game_notes = []
        
        for note_data in self.parsed_data['notes']:
            if note_data['type'] in ['note', 'chord_note']:
                # Convert to game format
                game_note = {
                    'midi_number': note_data['midi_number'],
                    'start_time_ms': note_data['start_time_seconds'] * 1000,
                    'duration_ms': note_data['duration_seconds'] * 1000,
                    'pitch_name': f"{note_data['pitch']}{note_data['octave']}",
                    'velocity': note_data.get('velocity', 64),
                    'measure': note_data.get('measure_number', 1),
                    'note_type': 'hold' if note_data['duration_seconds'] > 0.5 else 'tap'
                }
                game_notes.append(game_note)
        
        return game_notes


def main():
    """Main function for command-line usage"""
    if len(sys.argv) < 3:
        print("Usage: python musicxml_parser.py <command> <file_path>")
        print("Commands: parse, game_notes")
        sys.exit(1)
    
    command = sys.argv[1]
    file_path = sys.argv[2]
    
    try:
        parser = MusicXMLParser()
        
        if command == "parse":
            # Parse and return full data
            result = parser.parse_file(file_path)
            print(json.dumps(result, indent=2))
            
        elif command == "game_notes":
            # Parse and return game-formatted notes
            parser.parse_file(file_path)
            game_notes = parser.get_midi_notes_for_game()
            result = {
                'notes': game_notes,
                'metadata': parser.parsed_data['metadata'],
                'tempo': parser.parsed_data['tempo'],
                'total_duration': parser.parsed_data['total_duration']
            }
            print(json.dumps(result, indent=2))
            
        else:
            print(f"Unknown command: {command}")
            sys.exit(1)
            
    except Exception as e:
        error_result = {
            'error': str(e),
            'success': False
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main() 