# 🛸 FlytBase Drone Traffic Analytics — Full-Stack Vision Intelligence

A modern, production-grade aerial traffic intelligence web application combining **VisDrone-fine-tuned YOLOv11s** object detection, **Supervision InferenceSlicer** for tiled high-resolution inference, **ByteTrack** multi-object tracking, and a **Vite + Vanilla JS** dark-mode analytics dashboard.

## City Wide AI Engine — Project Overview

This project is the foundation for a **City Wide AI Engine for Multi-Camera ANPR Trajectory Tracking and Urban Traffic Analytics**. It converts traffic video into data about each road user: vehicle type, `track_id`, position, time, speed, and route.

The current system processes one drone/video feed at a time. It detects cars, buses, trucks, motorcycles, bicycles, three-wheelers, and pedestrians; then it shows counts, speed, traffic state, and an annotated video. **ANPR (Automatic Number Plate Recognition) and cross-camera matching are planned future features.**

```text
Video → YOLO detection → NMS → ByteTrack → trajectory → speed → traffic dashboard
```

## Technical Terms and Maths

- **YOLOv11s detection:** finds every road user and returns a bounding box `(x1, y1, x2, y2)`, class, and confidence score.
- **Tiled inference:** splits a 4K frame into overlapping `1024 × 1024` tiles, helping YOLO detect small and distant vehicles.
- **NMS (Non-Maximum Suppression):** removes duplicate boxes created in overlapping tiles. It uses **IoU (Intersection over Union)**:

  ```text
  IoU = overlap area / combined area
  ```

- **ByteTrack:** connects the same vehicle across frames and gives it a stable `track_id`, so one car is counted once instead of once per frame. It can keep a lost track briefly during an occlusion.
- **Class consensus:** avoids labels switching between car and van. The final class is the confidence-weighted majority across the track:

  ```text
  final class = class with the highest Σ confidence
  ```

- **Trajectory:** the ordered location history of a vehicle. The project uses the bottom-centre of the bounding box as the approximate road position:

  ```text
  cx = (x1 + x2) / 2,  cy = y2
  ```

- **Speed estimation:** calculate movement between positions and divide by elapsed time:

  ```text
  distance_px = √((x₂ - x₁)² + (y₂ - y₁)²)
  speed_km/h = (distance_px / Δt) × metres_per_pixel × 3.6
  ```

  `3.6` converts metres/second to km/h. The live system uses approximately `0.035 metres/pixel` for drone footage, applies **EMA (Exponential Moving Average)** smoothing, and treats speeds below `2.5 km/h` as stopped.

- **Homography and GCPs (Ground Control Points):** for more accurate speed and distance, map image points to real road coordinates `(X, Y)` in metres. This corrects camera perspective and is important for CCTV and city-wide deployment.
- **Savitzky-Golay filter:** smooths noisy trajectory data before calculating velocity, acceleration, and heading. Heading change identifies through movements, left/right turns, and U-turns.

## Traffic Analytics and Roadmap

From trajectories, the system can calculate unique vehicle counts, modal split, flow, speed profiles, queue length, density, occupancy, and origin–destination/turning movements. **PCU (Passenger Car Unit)** can also convert mixed vehicle types into a common traffic-capacity measure.

For a full multi-camera ANPR system, add plate detection + OCR, privacy-safe plate storage, cross-camera vehicle re-identification, camera-to-map calibration, and a global trajectory graph for city-wide journey and congestion analysis.

---

## 📁 Clean Repository Structure

```
flybase_hackathon_cv-main/
├── backend/                        # FastAPI Backend & ML Pipeline
│   ├── main.py                     # FastAPI application & REST/SSE endpoints
│   ├── tracker.py                  # VisDrone YOLO11s tiled tracking engine
│   ├── analytics.py                # Trajectory analytics & kinematic metrics
│   ├── config.py                   # Model configuration & class taxonomy
│   ├── l3_core.py                  # Advanced Level 3 aggregate traffic analytics
│   ├── calibration.json            # Camera & ground plane calibration
│   ├── requirements.txt            # Python dependencies
│   └── notebooks/                  # Consolidated Notebooks & Telemetry
│       ├── hackathon_pipeline_master.ipynb  # Complete merged Jupyter pipeline (L1-L3)
│       ├── Intersection_1080p.srt           # Drone telemetry subtitle track
│       └── labels_*.json                    # Ground-truth annotations
│
├── frontend/                       # Modern Vite Analytics Frontend
│   ├── index.html                  # HTML entry point (Inter & JetBrains Mono)
│   ├── package.json                # Frontend dependencies
│   ├── vite.config.js              # Vite server & API proxy config
│   └── src/
│       ├── main.js                 # App orchestrator & SSE streaming client
│       ├── style.css               # Glassmorphic dark design system
│       ├── api.js                  # Backend API client
│       ├── components/
│       │   ├── upload.js           # Drag-and-drop video upload zone
│       │   ├── dashboard.js        # Analytics & metrics dashboard
│       │   ├── video-player.js     # Annotated video playback component
│       │   └── charts.js           # Chart.js visualizations (Modal split, speed)
│       └── utils/
│           └── format.js           # Number, duration & metric formatters
│
├── Test.mp4                        # Sample test video
├── Test2.mp4                       # High-resolution 4K test video
├── CONTEXT.md                      # Technical specifications & geometry
└── requirements.txt                # Root Python dependencies
```

---

## 🚀 Quick Start (Easiest Method)

From the root directory:

### 1. Launch Backend
```bash
./run_backend.sh
```
*(Runs FastAPI server on `http://localhost:8000` using your Miniconda Python environment)*

### 2. Launch Frontend
In a separate terminal tab:
```bash
./run_frontend.sh
```
*(Runs Vite Dev server on `http://localhost:5173`)*

---

### Manual Method (Alternative)

```bash
# Backend
cd backend
/opt/miniconda3/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## ⚡ Features

1. **Exact VisDrone YOLO11s Model**: Fine-tuned on the VisDrone dataset (`dronefreak/visdrone-yolov11s`) for high-accuracy small-object detection in aerial footage.
2. **Tiled Inference**: `supervision.InferenceSlicer` (1024×1024 tiles with 20% overlap) to accurately detect tiny vehicles and pedestrians in 4K drone video.
3. **ByteTrack ID Persistence**: Multi-object tracking with trajectory stitching and ID persistence across occlusions.
4. **Real-Time SSE Progress**: Live progress bar with processed frames, processing FPS, and accurate ETA streamed via Server-Sent Events.
5. **Interactive Dashboard**:
   - High-level metric cards (Unique road users, total detections, classes, average duration)
   - Dynamic charts (Modal split donut, detections by class, track duration distribution, model confidence)
   - Inline annotated video playback (`tracks_annotated.mp4`)
   - Interactive track directory table with displacement, speeds, and timestamp ranges
   - 1-click Parquet dataset export (`tracks.parquet`)
6. **Unified Master Notebook**: All previous hackathon levels (Level 1 Detection, Level 2 Kinematics, Level 3 Aggregate Insights) are consolidated in [`backend/notebooks/hackathon_pipeline_master.ipynb`](backend/notebooks/hackathon_pipeline_master.ipynb).
