#!/usr/bin/env python3

import sys
import json
import os
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr
from gradio_client import Client

def generate_tts(text, voice_name="af_heart", format_type="wav", speed=1.0):
    """
    Generate TTS audio using Gradio client
    """
    try:
        # Capture gradio_client output to prevent it from interfering with JSON
        captured_output = StringIO()
        captured_errors = StringIO()
        
        with redirect_stdout(captured_output), redirect_stderr(captured_errors):
            # Connect to the Gradio server
            client = Client("http://127.0.0.1:7860/")
            
            # Call the TTS generation API
            result = client.predict(
                voice_name=voice_name,
                text=text,
                format=format_type,
                speed=speed,
                api_name="/generate_tts_with_logs"
            )
        
        # Return the result (should be a file path)
        return {
            "success": True,
            "audio_path": result,
            "message": f"TTS generated successfully with voice {voice_name}"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": f"Failed to generate TTS: {str(e)}"
        }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Missing required argument: text"
        }))
        return
    
    # Get arguments
    text = sys.argv[1]
    voice_name = sys.argv[2] if len(sys.argv) > 2 else "af_heart"
    format_type = sys.argv[3] if len(sys.argv) > 3 else "wav"
    speed = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
    
    # Generate TTS
    result = generate_tts(text, voice_name, format_type, speed)
    
    # Output result as JSON
    print(json.dumps(result))

if __name__ == "__main__":
    main() 