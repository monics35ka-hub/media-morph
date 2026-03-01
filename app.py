
from flask import Flask, render_template, request, jsonify, send_from_directory
import os
from werkzeug.utils import secure_filename
import speech_recognition as sr
from pydub import AudioSegment
import requests

app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 80 * 1024 * 1024

# Optional Google Custom Search credentials (set as env vars)
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY') or ''
GOOGLE_CX = os.environ.get('GOOGLE_CX') or ''

ALLOWED_EXT = {'wav','mp3','m4a','ogg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.',1)[1].lower() in ALLOWED_EXT

def ffmpeg_available():
    from shutil import which
    path = which('ffmpeg') or which('ffmpeg.exe')
    if path:
        AudioSegment.converter = path
        return True, path
    return False, None

@app.route('/')
def index():
    ffmpeg_ok, ffmpeg_path = ffmpeg_available()
    return render_template('index.html', ffmpeg_ok=ffmpeg_ok, ffmpeg_path=ffmpeg_path, google_enabled=bool(GOOGLE_API_KEY and GOOGLE_CX))

@app.route('/audio-to-text', methods=['POST'])
def audio_to_text():
    if 'audio_file' not in request.files:
        return jsonify({'success': False, 'error': 'No audio_file part in request.'}), 400
    f = request.files['audio_file']
    if f.filename == '':
        return jsonify({'success': False, 'error': 'No selected file.'}), 400
    if not allowed_file(f.filename):
        return jsonify({'success': False, 'error': 'Unsupported file type.'}), 400
    filename = secure_filename(f.filename)
    saved = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    f.save(saved)
    ok, _ = ffmpeg_available()
    if not ok:
        return jsonify({'success': False, 'error': 'ffmpeg not found on server. Install ffmpeg and add to PATH.'}), 500
    try:
        ext = filename.rsplit('.',1)[1].lower()
        wav_path = saved if ext == 'wav' else saved + '.wav'
        if ext != 'wav':
            sound = AudioSegment.from_file(saved)
            sound = sound.set_channels(1)
            sound.export(wav_path, format='wav')
        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)
        lang = request.form.get('language','en')
        sr_lang = 'ta-IN' if lang=='ta' else 'en-US'
        try:
            text = recognizer.recognize_google(audio_data, language=sr_lang)
        except sr.UnknownValueError:
            text = ''
        except sr.RequestError as e:
            return jsonify({'success': False, 'error': f'Speech API request failed: {e}'}), 500
        return jsonify({'success': True, 'transcript': text})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/search-images', methods=['GET'])
def search_images():
    q = request.args.get('q','').strip()
    if not q:
        return jsonify({'success': False, 'error': 'Query empty.'}), 400
    if not (GOOGLE_API_KEY and GOOGLE_CX):
        imgs = [f'https://via.placeholder.com/800x600?text={q}+{i+1}' for i in range(5)]
        return jsonify({'success': True, 'images': imgs, 'warning': 'GOOGLE_API_KEY or GOOGLE_CX not set; returning placeholders.'})
    try:
        params = {'key': GOOGLE_API_KEY, 'cx': GOOGLE_CX, 'q': q, 'searchType': 'image', 'num': 5}
        r = requests.get('https://www.googleapis.com/customsearch/v1', params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        items = data.get('items', [])[:5]
        images = [it.get('link') for it in items if it.get('link')]
        return jsonify({'success': True, 'images': images})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=False)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
