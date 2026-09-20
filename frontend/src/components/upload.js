/**
 * upload.js — Video upload component with image preview, video preview,
 * test video download buttons, and Start Analysis button.
 */

export function renderUpload(container, { onFileSelected }) {
  let selectedFile = null;

  container.innerHTML = `
    <section class="upload-section">
      <div class="container" style="display:flex;flex-direction:column;align-items:center;">

        <div class="upload-hero animate-in">
          <h1 class="upload-title">Drone traffic analysis</h1>
        </div>

        <!-- Upload zone card with decorative elements -->
        <div class="upload-card-container animate-in animate-in-delay-1">
          <!-- Decorative floating circles -->
          <div class="upload-decorations">
            <div class="deco-circle deco-circle-1"></div>
            <div class="deco-circle deco-circle-2"></div>
            <div class="deco-circle deco-circle-3"></div>
          </div>

          <!-- Floating side cards -->
          <div class="floating-card floating-card-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-emerald);">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>Detection Ready</span>
          </div>

          <div class="floating-card floating-card-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-purple);">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span>Tracking Active</span>
          </div>

          <div class="floating-card floating-card-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-blue);">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <span>HD Analysis</span>
          </div>

          <!-- Main upload drop zone -->
          <div class="upload-zone" id="upload-zone">
            <img src="/img1.jpg" alt="Drone traffic analysis" class="upload-hero-img" />
              <input type="file" class="upload-input" id="upload-input" accept="video/*" />
          </div>

          <!-- Video preview (hidden initially) -->
          <div class="video-preview-container" id="video-preview-container" style="display: none;">
            <video class="video-preview-player" id="video-preview-player" muted></video>
            <div class="video-preview-controls" id="video-preview-controls">
              <button class="video-preview-playpause" id="btn-playpause">
                <svg id="icon-play" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <svg id="icon-pause" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="display:none;">
                  <rect x="6" y="4" width="4" height="16"/>
                  <rect x="14" y="4" width="4" height="16"/>
                </svg>
              </button>
              <span class="video-preview-filename" id="preview-filename"></span>
            </div>
          </div>
        </div>

        <!-- Buttons row -->
        <div class="upload-buttons-row animate-in animate-in-delay-2">
          <button class="btn-start-analysis" id="btn-start-analysis" disabled>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Start Analysis
          </button>

          <a href="/Test.mp4" download="Test.mp4" class="btn-download-test">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Test Video 1
          </a>

          <a href="/Test2.mp4" download="Test2.mp4" class="btn-download-test">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Test Video 2
          </a>
        </div>

      </div>
    </section>
  `;

  const zone = container.querySelector('#upload-zone');
  const input = container.querySelector('#upload-input');
  const startBtn = container.querySelector('#btn-start-analysis');
  const videoPreviewContainer = container.querySelector('#video-preview-container');
  const videoPreviewPlayer = container.querySelector('#video-preview-player');
  const btnPlayPause = container.querySelector('#btn-playpause');
  const iconPlay = container.querySelector('#icon-play');
  const iconPause = container.querySelector('#icon-pause');
  const previewFilename = container.querySelector('#preview-filename');

  // Click to browse
  zone.addEventListener('click', () => input.click());

  // File selected via input
  input.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      selectedFile = e.target.files[0];
      showVideoPreview(selectedFile);
    }
  });

  // Drag & drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      selectedFile = e.dataTransfer.files[0];
      showVideoPreview(selectedFile);
    }
  });

  // Start analysis button
  startBtn.addEventListener('click', () => {
    if (selectedFile) {
      onFileSelected(selectedFile);
    }
  });

  // Play/Pause toggle
  btnPlayPause.addEventListener('click', (e) => {
    e.stopPropagation();
    if (videoPreviewPlayer.paused) {
      videoPreviewPlayer.play();
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
    } else {
      videoPreviewPlayer.pause();
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
    }
  });

  videoPreviewPlayer.addEventListener('ended', () => {
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
  });

  function showVideoPreview(file) {
    // Hide the upload zone, show video preview
    zone.style.display = 'none';
    videoPreviewContainer.style.display = 'block';

    const url = URL.createObjectURL(file);
    videoPreviewPlayer.src = url;
    videoPreviewPlayer.load();
    previewFilename.textContent = file.name;

    startBtn.disabled = false;

    // Reset play state
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
  }
}
