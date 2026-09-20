/**
 * video-player.js — High-tech Drone HUD video player with vehicle lock-on tracking.
 */

import { getVideoUrl } from '../api.js';

let activeLock = {
  trackId: null,
  meta: null,
  traj: null,
};

export function renderVideoPlayer(container, jobId, meta, trajectories = {}, onLockChanged = null) {
  container.innerHTML = `
    <div class="video-card animate-in" id="video-card">
      <div class="video-stage" id="video-stage">
        <video
          id="main-video-player"
          class="video-player"
          controls
          autoplay
          muted
          loop
          preload="auto"
          src="${getVideoUrl(jobId)}"
        >
          Your browser does not support the video tag.
        </video>

        <div id="hud-target-box" class="hud-target-box" style="display: none;">
          <div class="hud-corners top-left"></div>
          <div class="hud-corners top-right"></div>
          <div class="hud-corners bottom-left"></div>
          <div class="hud-corners bottom-right"></div>
          <div class="hud-crosshair"></div>
          <div class="hud-tag" id="hud-tag">
            <span class="hud-tag-id">#--</span>
            <span class="hud-tag-spd">-- km/h</span>
          </div>
        </div>

        <!-- Telemetry Banner on bottom-left of video -->
        <div id="hud-telemetry-pill" class="hud-telemetry-pill" style="display: none;">
          <div class="pill-dot"></div>
          <div class="pill-info">
            <span class="pill-title" id="pill-title">LOCK ACQUIRED</span>
            <span class="pill-desc" id="pill-desc">Tracking object...</span>
          </div>
          <button id="btn-release-lock" class="btn btn-outline btn-sm" style="margin-left: 8px; padding: 4px 8px; font-size: 11px; background: rgba(255,255,255,0.9);">
            Release
          </button>
        </div>
      </div>
    </div>
  `;

  const video = container.querySelector('#main-video-player');
  const stage = container.querySelector('#video-stage');
  const targetBox = container.querySelector('#hud-target-box');
  const tagEl = container.querySelector('#hud-tag');
  const releaseBtn = container.querySelector('#btn-release-lock');
  const pill = container.querySelector('#hud-telemetry-pill');
  const pillTitle = container.querySelector('#pill-title');
  const pillDesc = container.querySelector('#pill-desc');

  function updateHUDPosition() {
    if (!activeLock.trackId || !activeLock.traj) {
      targetBox.style.display = 'none';
      return;
    }

    const t = video.currentTime;
    const traj = activeLock.traj;
    const times = traj.t;
    const boxes = traj.box;
    const speeds = traj.speed;

    if (!times || times.length === 0) {
      targetBox.style.display = 'none';
      return;
    }

    // Check if within time window
    const firstT = times[0];
    const lastT = times[times.length - 1];

    if (t < firstT - 0.4 || t > lastT + 0.4) {
      targetBox.style.display = 'none';
      return;
    }

    // Find nearest box in time
    let bestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < times.length; i++) {
      const diff = Math.abs(times[i] - t);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }

    const normBox = boxes[bestIdx]; // [x1, y1, x2, y2] normalized 0..1
    const spd = speeds[bestIdx] || 0;

    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;
    const left = normBox[0] * stageWidth;
    const top = normBox[1] * stageHeight;
    const width = Math.max((normBox[2] - normBox[0]) * stageWidth, 24);
    const height = Math.max((normBox[3] - normBox[1]) * stageHeight, 24);

    targetBox.style.display = 'block';
    targetBox.style.left = `${left}px`;
    targetBox.style.top = `${top}px`;
    targetBox.style.width = `${width}px`;
    targetBox.style.height = `${height}px`;

    const spdText = spd > 0 ? `${Math.round(spd)} km/h` : 'Stopped';
    tagEl.innerHTML = `
      <span class="hud-tag-id">#${activeLock.trackId} ${activeLock.meta.label}</span>
      <span class="hud-tag-spd">${spdText}</span>
    `;

    pillTitle.textContent = `TARGET #${activeLock.trackId} [${activeLock.meta.label.toUpperCase()}]`;
    pillDesc.textContent = `Speed: ${spdText} • Window: ${firstT}s → ${lastT}s`;
  }

  // Bind animation frame / timeupdate
  let animId = null;
  function startTrackingLoop() {
    updateHUDPosition();
    animId = requestAnimationFrame(startTrackingLoop);
  }
  startTrackingLoop();

  releaseBtn.addEventListener('click', () => {
    unlockTarget();
    if (onLockChanged) onLockChanged(null);
  });

  function lockTarget(trackId, trackMeta) {
    const traj = trajectories[trackId];
    activeLock = {
      trackId,
      meta: trackMeta,
      traj,
    };

    releaseBtn.style.display = 'inline-flex';
    pill.style.display = 'flex';

    if (trackMeta && trackMeta.first_seen_s != null) {
      video.currentTime = Math.max(trackMeta.first_seen_s - 0.2, 0);
      video.play().catch(() => {});
    }

    // Smoothly scroll stage into view if not visible
    stage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function unlockTarget() {
    activeLock = { trackId: null, meta: null, traj: null };
    targetBox.style.display = 'none';
    pill.style.display = 'none';
  }

  return {
    lockTarget,
    unlockTarget,
    video,
  };
}
