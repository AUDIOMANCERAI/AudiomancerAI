import os
import io
import time
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS 
from pydub import AudioSegment

# --- 1. CONFIGURATION ---
# Gunicorn looks for this globally named 'app' instance.
app = Flask(__name__) 

# CRITICAL: This allows your Vercel frontend to talk to this Render backend.
# IMPORTANT: Replace 'YOUR_VERCEL_FRONTEND_URL' with your actual Vercel URL.
CORS(app, resources={r"/*": {"origins": "https://audiomancer-aii.vercel.app/"}}) 

# Use a temporary directory for file processing
TEMP_DIR = '/tmp/audio' 
os.makedirs(TEMP_DIR, exist_ok=True)


# --- 2. CORE AUDIO PROCESSING LOGIC ---

def perform_crossfade_and_conversion(file1_stream, file2_stream, duration_ms):
    """
    Performs the crossfade using pydub and exports the resulting track.
    Accepts file streams (FileStorage objects) as input.
    """
    
    # Load tracks from the file streams provided by Flask's request object
    # pydub auto-detects format from the file data when format is not specified
    track1 = AudioSegment.from_file(file1_stream)
    track2 = AudioSegment.from_file(file2_stream)
    
    # 1. Perform the Crossfade
    # Append track 2 to the end of track 1, applying the crossfade
    combined_track = track1.append(
        track2,
        crossfade=duration_ms
    )
    
    # 2. Export the resulting audio to an in-memory buffer (BytesIO)
    # This avoids saving the file to disk, improving performance and cleanliness
    output_buffer = io.BytesIO()
    combined_track.export(
        output_buffer,
        format="mp3",
        bitrate="320k"
    )
    
    # Reset buffer position to the start before returning
    output_buffer.seek(0)
    return output_buffer


# --- 3. API ENDPOINTS ---

@app.route('/', methods=['GET'])
def home():
    """A simple check to see if the server is running."""
    return "Audiomancer Backend is Running!", 200

@app.route('/mix_tracks', methods=['POST'])
def mix_tracks():
    """
    Endpoint for the audio conversion/mixing bot.
    Receives two files and crossfade duration, returns the final MP3.
    """
    # 1. Validate input files
    if 'track_a' not in request.files or 'track_b' not in request.files:
        return jsonify({"error": "Missing one or both audio files in the request."}), 400

    file_a = request.files['track_a']
    file_b = request.files['track_b']
    
    # Safely get duration, default to 3000ms (3 seconds)
    crossfade_duration = int(request.form.get('duration_ms', 3000))

    try:
        # 2. Process files in memory
        output_buffer = perform_crossfade_and_conversion(
            file_a,
            file_b,
            crossfade_duration
        )
        
        # 3. Stream the final file back to the user
        return send_file(
            output_buffer,
            as_attachment=True,
            download_name='audiomancer_mix.mp3',
            mimetype='audio/mpeg'
        )
    
    except Exception as e:
        # Handle audio decoding or processing errors
        print(f"Audio Processing Error: {e}")
        return jsonify({
            "error": "Failed to process audio. Ensure files are valid MP3/WAV and FFmpeg is installed on the server."
        }), 500

# --- 4. LOCAL RUNNER (Ignored by Gunicorn) ---
if __name__ == '__main__':
    # Use 0.0.0.0 to listen on all public IPs, useful for local testing
    app.run(debug=True, host='0.0.0.0', port=5000)
# --- 5. LOCAL RUNNER (Ignored by Gunicorn, but useful for local testing) ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)