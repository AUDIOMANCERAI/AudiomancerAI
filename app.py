import os
import io
import time
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS 
# New import for direct FFmpeg control
import ffmpeg 

# --- 1. CONFIGURATION ---
# Gunicorn looks for this globally named 'app' instance.
app = Flask(__name__) 

# CRITICAL: This allows your Vercel frontend to talk to this Render backend.
# IMPORTANT: Replace 'YOUR_VERCEL_FRONTEND_URL' with your actual Vercel URL.
CORS(app, resources={r"/*": {"origins": "audiomancer-qe9p08z67-mike-hutchings-projects.vercel.app"}}) 

# Use a temporary directory for file processing
TEMP_DIR = '/tmp/audio' 
os.makedirs(TEMP_DIR, exist_ok=True)