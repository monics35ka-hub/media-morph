
document.addEventListener('DOMContentLoaded', function () {
  // UI: show tool on card click
  const cards = document.querySelectorAll('.feature-card');
  const toolsArea = document.getElementById('toolsArea');
  const homeCards = document.getElementById('homeCards');
  const backWrap = document.getElementById('backWrap');
  const backBtn = document.getElementById('backBtn');

  cards.forEach(c => c.addEventListener('click', () => {
    const target = c.getAttribute('data-target');
    showTool(target);
  }));

  backBtn.addEventListener('click', () => { hideTools(); });

  function showTool(id) {
    homeCards.style.display = 'none';
    backWrap.style.display = 'block';
    document.querySelectorAll('.tool-box').forEach(t => t.style.display = 'none');
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
    window.scrollTo({ top: document.querySelector('main').offsetTop, behavior: 'smooth' });
  }
  function hideTools() {
    homeCards.style.display = 'flex';
    backWrap.style.display = 'none';
    document.querySelectorAll('.tool-box').forEach(t => t.style.display = 'none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Audio -> Text
  const audioForm = document.getElementById('audioForm');
  const audioResult = document.getElementById('audioResult');
  const downloadBtn = document.getElementById('downloadTranscript');
  let lastTranscript = '';

  audioForm && audioForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    audioResult.innerHTML = 'Uploading and transcribing...';
    const fileInput = document.getElementById('audioFile');
    if (!fileInput.files.length) { audioResult.innerHTML = '<div class="text-danger">Choose an audio file.</div>'; return; }
    const fd = new FormData();
    fd.append('audio_file', fileInput.files[0]);
    fd.append('language', document.getElementById('audioLang').value);
    try {
      const res = await fetch('/audio-to-text', { method:'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        lastTranscript = data.transcript || '';
        audioResult.innerHTML = '<div class="alert alert-success"><strong>Transcript</strong><pre>' + (lastTranscript || '(no text detected)') + '</pre></div>';
      } else {
        audioResult.innerHTML = '<div class="alert alert-danger">Error: ' + (data.error || 'Unknown') + '</div>';
      }
    } catch (err) {
      audioResult.innerHTML = '<div class="alert alert-danger">Request failed: ' + err.message + '</div>';
    }
  });

  downloadBtn && downloadBtn.addEventListener('click', function () {
    if (!lastTranscript) { alert('No transcript yet.'); return; }
    const blob = new Blob([lastTranscript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Text -> Audio
  const synth = window.speechSynthesis;
  let utter = null;
  document.getElementById('playTts') && document.getElementById('playTts').addEventListener('click', function () {
    const text = document.getElementById('ttsText').value.trim();
    if (!text) return alert('Enter text first.');
    const lang = document.getElementById('ttsLang').value;
    if (synth.speaking) synth.cancel();
    utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    const voices = synth.getVoices();
    const v = voices.find(x => x.lang && x.lang.startsWith(lang.split('-')[0]));
    if (v) utter.voice = v;
    synth.speak(utter);
  });
  document.getElementById('stopTts') && document.getElementById('stopTts').addEventListener('click', function () { if (synth.speaking) synth.cancel(); });

  // Text -> Image search
  document.getElementById('searchImg') && document.getElementById('searchImg').addEventListener('click', async function () {
    const q = document.getElementById('imgQuery').value.trim();
    const imagesRow = document.getElementById('imagesRow');
    imagesRow.innerHTML = '<div class="col-12">Searching...</div>';
    if (!q) { imagesRow.innerHTML = '<div class="col-12 text-danger">Enter a query.</div>'; return; }
    try {
      const res = await fetch('/search-images?q=' + encodeURIComponent(q));
      const data = await res.json();
      if (data.success) {
        imagesRow.innerHTML = '';
        data.images.forEach(src => {
          const col = document.createElement('div');
          col.className = 'col-6 col-md-4 col-lg-3';
          const img = document.createElement('img');
          img.src = src;
          img.alt = q;
          img.loading = 'lazy';
          col.appendChild(img);
          imagesRow.appendChild(col);
        });
        if (data.warning) {
          const warn = document.createElement('div');
          warn.className = 'col-12 mt-2 text-warning small';
          warn.textContent = data.warning;
          imagesRow.appendChild(warn);
        }
      } else {
        imagesRow.innerHTML = '<div class="col-12 text-danger">Error: ' + (data.error || 'Unknown') + '</div>';
      }
    } catch (err) {
      imagesRow.innerHTML = '<div class="col-12 text-danger">Request failed: ' + err.message + '</div>';
    }
  });

});
