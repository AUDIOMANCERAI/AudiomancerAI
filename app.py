from flask import Flask, jsonify, request
from flask_cors import CORS
import os
# Import the Python Google AI SDK
from google import genai
from google.genai.errors import APIError

# 1. CORE APPLICATION INSTANCE
app = Flask(__name__) 

# Set CORS for safety, allowing local and Vercel domains (as discussed)
CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:5173",  # Assuming Vite runs on 5173
    "http://localhost:3000",
    "https://*.vercel.app",  # Allows all Vercel subdomains (e.g., your project and previews)
    "https://audiomancer-aii.vercel.app" # Your production domain
]}})

# 2. API Health Check
@app.route('/api', methods=['GET'])
def home():
    return "Audiomancer Backend is Running Securely!", 200

# 3. SECURE IMAGE GENERATION ROUTE (Migrated from geminiService.ts)
@app.route('/api/generate-image', methods=['POST'])
def generate_image_secure():
    try:
        data = request.get_json()
        prompt = data.get('prompt')
        
        if not prompt:
            return jsonify({"error": "Prompt is required."}), 400

        # Initialise the AI Client securely on the SERVER
        # Uses the API_KEY set in Vercel/Local environment variables
        api_key = os.environ.get('API_KEY')
        if not api_key:
            return jsonify({"error": "API key not configured on the server."}), 500

        client = genai.Client(api_key=api_key)

        response = client.models.generate_images(
            model='imagen-4.0-generate-001',
            prompt=prompt,
            config={
              "numberOfImages": 1,
              "outputMimeType": 'image/jpeg',
              "aspectRatio": '1:1',
            },
        )
        
        # The Python SDK returns the image bytes directly (Base64 encoded)
        image_bytes = response.generated_images[0].image.image_bytes
        
        # Send the Base64 image bytes back to the frontend
        return jsonify({"imageBytes": image_bytes}), 200

    except APIError as e:
        print(f"Gemini API Error: {e}")
        return jsonify({"error": f"AI Generation Failed: {e}"}), 500
    except Exception as e:
        print(f"Server Error: {e}")
        return jsonify({"error": "An unexpected server error occurred."}), 500


# 4. LOCAL RUNNER
if __name__ == '__main__':
    # ... no change ...
    app.run(debug=True, host='0.0.0.0', port=5000)

# --- END OF FILE app.py (MODIFIED) ---
