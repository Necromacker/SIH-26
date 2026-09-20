---
title: Traffic Analysis API
emoji: 🛸
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Traffic Analysis API (same FastAPI logic as local)

This Space runs the existing backend:

- `POST /api/upload`
- `GET /api/status/{job_id}` (SSE)
- `GET /api/results/{job_id}`
- `GET /api/video/{job_id}`
- `GET /api/download/{job_id}`
- `GET /health`

Model: `dronefreak/visdrone-yolov11s` (`best.pt`).

Netlify env:

```text
VITE_API_BASE=https://<user>-<space>.hf.space
```
