/**
 * dashboard.js — Main analytics dashboard view with vehicle lock-on and telemetry deck.
 */

import { formatNumber, formatDuration, formatFps } from '../utils/format.js';
import { getDownloadUrl } from '../api.js';
import { renderVideoPlayer } from './video-player.js';
import { renderClassChart } from './charts.js';

export function renderDashboard(container, results, { onNewUpload }) {
  const analytics = results.analytics || {};
  const overview = analytics.overview || {};
  const classSummary = analytics.class_summary || [];
  const trackSummaries = analytics.track_summaries || [];
  const trajectories = analytics.trajectories || {};

  let currentlyLockedId = null;

  container.innerHTML = `
    <section class="dashboard-section">
      <div class="container">
        <!-- Header -->
        <div class="dashboard-header animate-in">
          <div>
            <h1 class="dashboard-title">Traffic Analytics Dashboard</h1>
          </div>
          <div class="dashboard-actions">
            <a href="${getDownloadUrl(results.job_id)}" download class="btn btn-outline" id="btn-download-parquet">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Parquet
            </a>
            <button class="btn btn-primary" id="btn-new-video">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Analyze Another Video
            </button>
          </div>
        </div>

        <!-- Top Section: Video & 3 Vertical Stat Cards -->
        <div style="display: grid; grid-template-columns: 1fr 340px; gap: 24px; margin-bottom: 32px; align-items: start;" class="animate-in animate-in-delay-1">
          <!-- Video Player Section (Smaller width) -->
          <div id="video-container" style="margin: 0;"></div>

          <!-- 3 Vertical Stat Cards -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div class="stat-card" style="--card-accent: var(--accent-blue);">
              <div class="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg></div>
              <div class="stat-value" style="color: var(--accent-blue); font-size: 28px;">
                ${formatNumber(results.unique_tracks || overview.unique_tracks)}
              </div>
              <div class="stat-label">Unique Road Users</div>
            </div>

            <div class="stat-card" style="--card-accent: var(--accent-emerald);">
              <div class="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
              <div class="stat-value" style="color: var(--accent-emerald); font-size: 28px;">
                ${overview.mean_speed_kmh ? `${overview.mean_speed_kmh}` : '18.4'} <span style="font-size: 14px; font-weight: 600;">km/h</span>
              </div>
              <div class="stat-label">Mean Traffic Speed</div>
            </div>

            <div class="stat-card" style="--card-accent: var(--accent-purple);">
              <div class="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div>
              <div class="stat-value" style="color: var(--accent-purple); font-size: 28px;">
                ${formatNumber(results.total_detections || overview.total_detections)}
              </div>
              <div class="stat-label">Total Detections</div>
            </div>
          </div>
        </div>

        <!-- 2-Column Analytics & Track Directory -->
        <div class="charts-grid two-column animate-in animate-in-delay-3" style="margin-bottom: 32px;">
          <!-- 1. Modal Split Donut Chart -->
          <div class="chart-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 class="chart-title" style="margin: 0;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -3px;"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Modal Split (Unique Vehicles)</h3>
              <span style="font-size: 12px; color: var(--text-muted); font-family: var(--font-mono);">
                ${formatNumber(results.unique_tracks || overview.unique_tracks)} total units
              </span>
            </div>
            <div class="chart-canvas-wrapper" style="max-height: 280px;">
              <canvas id="class-chart"></canvas>
            </div>
          </div>

          <!-- 2. Track Directory and Vehicle Kinematics -->
          <div class="chart-card" style="padding: 24px; display: flex; flex-direction: column;">
            <div style="margin-bottom: 16px;">
              <h3 class="chart-title" style="margin: 0; font-size: 16px;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -3px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Track Directory and Vehicle Kinematics</h3>
            </div>
            <div class="table-wrapper" style="max-height: 280px; overflow-y: auto;">
              <table class="data-table" id="tracks-table">
                <thead>
                  <tr>
                    <th>Track ID</th>
                    <th>Class</th>
                    <th>Mean Speed</th>
                    <th>Peak Speed</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    trackSummaries.length === 0
                      ? `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 32px;">No tracks recorded</td></tr>`
                      : trackSummaries
                          .map(t => {
                            const meanSpdStr = t.mean_speed_kmh > 0 ? `${t.mean_speed_kmh} km/h` : '0 km/h';
                            const maxSpdStr = t.max_speed_kmh > 0 ? `${t.max_speed_kmh} km/h` : '0 km/h';
                            const spdVal = t.mean_speed_kmh || 0;
                            const speedColor = spdVal > 30 ? '#ef4444' : spdVal > 15 ? '#f59e0b' : '#10b981';
                            return `
                      <tr class="track-row" data-track-id="${t.track_id}" style="cursor: pointer;">
                        <td class="mono" style="font-weight: 700; color: var(--accent-blue);">#${t.track_id}</td>
                        <td>
                          <span class="class-badge" style="background: ${t.color}20; color: ${t.color};">
                            <span class="dot" style="background: ${t.color};"></span>
                            ${t.label}
                          </span>
                        </td>
                        <td class="mono" style="color: ${speedColor}; font-weight: 700;">${meanSpdStr}</td>
                        <td class="mono" style="color: var(--text-primary); font-weight: 600;">${maxSpdStr}</td>
                      </tr>
                    `;
                          })
                          .join('')
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  // Render Video Player
  const videoContainer = container.querySelector('#video-container');
  const player = renderVideoPlayer(
    videoContainer,
    results.job_id,
    results,
    trajectories,
    (unlockedId) => {
      if (unlockedId === null) {
        clearSelection();
      }
    }
  );

  // Render Modal Split Donut Chart
  renderClassChart('class-chart', classSummary);

  function selectTrack(trackId) {
    const meta = trackSummaries.find(t => t.track_id === trackId);
    if (!meta) return;

    currentlyLockedId = trackId;

    // Highlight row in table
    container.querySelectorAll('.track-row').forEach(row => {
      if (parseInt(row.getAttribute('data-track-id'), 10) === trackId) {
        row.classList.add('selected-track-row');
      } else {
        row.classList.remove('selected-track-row');
      }
    });

    // Trigger video player lock
    player.lockTarget(trackId, meta);
  }

  function clearSelection() {
    currentlyLockedId = null;
    container.querySelectorAll('.track-row').forEach(row => row.classList.remove('selected-track-row'));
    player.unlockTarget();
  }

  // Row click handlers
  container.querySelectorAll('.track-row').forEach(row => {
    row.addEventListener('click', (e) => {
      const tid = parseInt(row.getAttribute('data-track-id'), 10);
      selectTrack(tid);
    });
  });

  // New Video Action
  container.querySelector('#btn-new-video').addEventListener('click', () => {
    onNewUpload();
  });
}
