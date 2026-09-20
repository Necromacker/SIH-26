---
title: Drone Traffic Analytics
emoji: 🛸
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 5.31.0
python_version: '3.10'
app_file: app.py
pinned: false
---

# 🛸 FlytBase Drone Traffic Analytics — Full-Stack Vision Intelligence

A modern, production-grade aerial traffic intelligence web application combining **VisDrone-fine-tuned YOLOv11s** object detection, **Supervision InferenceSlicer** for tiled high-resolution inference, **ByteTrack** multi-object tracking, and a **Vite + Vanilla JS** dark-mode analytics dashboard.

## City Wide AI Engine — Project Overview

This project is the vision-analytics foundation for a **City Wide AI Engine for Multi-Camera ANPR Trajectory Tracking and Urban Traffic Analytics**.

It turns traffic video into structured, searchable trajectory data. For every detected road user, the system records its vehicle class, stable track ID, position, time, estimated speed, path, and traffic state. The dashboard then converts those individual observations into useful city-traffic intelligence: vehicle counts, modal split, speed distributions, stopped/slow vehicles, movement patterns, and downloadable trajectory data.

### Current implementation

The application currently processes one uploaded drone/video stream at a time. It detects and tracks cars, vans, trucks, buses, motorcycles, bicycles, three-wheelers, and pedestrians. It does **not yet perform ANPR (Automatic Number Plate Recognition) or cross-camera identity matching**; those are the next layers required for a complete city-wide multi-camera platform.

### End-to-end pipeline

```text
Traffic video
    → YOLO vehicle detection
    → Tile-level duplicate removal (NMS)
    → ByteTrack ID association across frames
    → Class-consensus and trajectory smoothing
    → Position-to-distance calibration
    → Speed / movement / traffic analytics
    → Dashboard, annotated video, and Parquet export
```

## Technical Terms and Maths

### 1. Object detection: “what is in this frame?”

The VisDrone-trained **YOLOv11s** model examines each video frame and returns a bounding box for every visible road user:

```text
(x1, y1, x2, y2, class, confidence)
```

Here `(x1, y1)` and `(x2, y2)` are the top-left and bottom-right corners of the box. The confidence score, from 0 to 1, expresses how certain the model is about the detection.

High-resolution drone frames are divided into overlapping `1024 × 1024` tiles. This makes small, distant vehicles large enough for the detector to recognise. Because a vehicle may occur in two overlapping tiles, **Non-Maximum Suppression (NMS)** keeps only the best duplicate box. Box overlap is measured by **Intersection over Union (IoU)**:

```text
IoU = overlap area of two boxes / combined area of both boxes
```

If two boxes have a high IoU, they probably describe the same vehicle.

### 2. Multi-object tracking: “which vehicle is which over time?”

**ByteTrack** associates detections in consecutive frames and gives each road user a persistent `track_id` such as `#42`. It compares the predicted position of an existing track with new detection boxes, using motion and box overlap to make the best match. This prevents one moving car from being counted again in every frame.

Tracking is not perfect: vehicles can be hidden by other vehicles, leave the frame, or be missed by the detector. The tracker therefore keeps a lost track alive briefly (`lost_track_buffer`) so that it can reconnect after a short occlusion.

To avoid labels flickering between similar classes such as car and van, the project uses a **confidence-weighted majority vote** across a track:

```text
score(class) = Σ detection confidence for that class
final class = class with the largest score
```

### 3. Trajectory: “where did a vehicle travel?”

For every tracked box, the system uses the bottom-centre point as the vehicle’s approximate road-contact position:

```text
cx = (x1 + x2) / 2
cy = y2
```

The ordered sequence `(time, cx, cy)` forms a **trajectory**. From trajectories we can calculate entry/exit points, direction, path length, stopped time, turning movement, queue behaviour, and interactions with other road users.

### 4. Vehicle speed estimation

Between two trajectory positions, pixel displacement is:

```text
distance_px = √((x₂ - x₁)² + (y₂ - y₁)²)
```

Pixel speed is then:

```text
speed_px_per_second = distance_px / Δt
```

To convert image pixels to real-world distance, the live backend currently uses an approximate ground sampling scale of `0.035 metres/pixel` for a near-nadir 4K drone view:

```text
speed_km/h = speed_px_per_second × metres_per_pixel × 3.6
```

The factor `3.6` converts metres/second to kilometres/hour. The last several observations of each track are used rather than just two frames, which reduces noise. An **Exponential Moving Average (EMA)** further smooths the result:

```text
smoothed_speed = 0.6 × current_speed + 0.4 × previous_smoothed_speed
```

Speeds below `2.5 km/h` are displayed as stopped to avoid treating small detector jitter as motion.

### 5. Accurate ground calibration and homography

Pixel distances alone are not reliable across a tilted camera image: one pixel near the camera may represent a different real-world distance than one pixel far away. For survey-grade speed and distance measurements, the project’s advanced pipeline uses **ground control points (GCPs)** and a **homography**.

A homography is a 3×3 perspective-transform matrix `H` that maps an image point `(u, v)` to a road-plane coordinate `(X, Y)` in metres:

```text
[X, Y, 1]ᵀ ∝ H × [u, v, 1]ᵀ
```

After mapping each trajectory point to metres, ground speed is computed more accurately as:

```text
speed_m/s = √((ΔX / Δt)² + (ΔY / Δt)²)
speed_km/h = speed_m/s × 3.6
```

This calibrated approach is especially important for fixed CCTV cameras and city-wide analytics.

### 6. Smoothing, heading, acceleration, and turns

Raw object positions have small frame-to-frame errors. Differentiating noisy positions directly exaggerates that noise, especially for acceleration. The advanced analytics pipeline uses a **Savitzky-Golay filter**, which fits a small local polynomial before calculating derivatives.

```text
velocity:     vx = dX/dt,  vy = dY/dt
speed:        v = √(vx² + vy²)
acceleration: ax = d²X/dt², ay = d²Y/dt²
heading:      atan2(vx, vy)
```

The change between a vehicle’s entry heading and exit heading classifies its movement:

- small heading change → through movement
- positive or negative medium change → right or left turn
- near 180° change → U-turn

### 7. Urban traffic analytics

The exported trajectory dataset supports the following measures:

- **Unique vehicle count:** number of distinct `track_id`s, rather than detections per frame.
- **Modal split:** share of cars, motorcycles, buses, trucks, pedestrians, and other classes.
- **Flow:** vehicles crossing a virtual line or entering a road segment per unit time.
- **Speed profile:** mean, median, maximum, and 85th-percentile speeds by road section or time interval.
- **Density:** number of vehicles within a road length or area.
- **Occupancy:** fraction of time/space in which a lane or detection zone is occupied.
- **Queue length:** stopped or slow vehicles grouped along an approach, measured in vehicles or metres after calibration.
- **Origin–destination / turning matrix:** counts grouped by detected entry leg and exit leg.
- **PCU (Passenger Car Unit):** a common-equivalent traffic measure that weights vehicle types differently; for example, a motorcycle consumes less road capacity than a bus or truck.

## Roadmap to Multi-Camera ANPR

To evolve this single-video trajectory engine into the full proposed city-wide solution, add:

1. **ANPR:** detect the licence plate, rectify the plate crop, run OCR, and retain only encrypted/hashed identifiers where privacy policy requires it.
2. **Cross-camera re-identification:** link a vehicle between cameras using plate match, vehicle appearance embedding, class, colour, direction, and plausible travel-time constraints.
3. **Camera calibration and map alignment:** map every camera’s image coordinates into a common road-network coordinate system.
4. **Global trajectory graph:** merge local tracklets into one city-level journey, enabling corridor travel time, route choice, congestion propagation, and origin–destination analytics.
5. **Privacy and governance:** role-based access, retention limits, audit logs, encryption, and legal safeguards for ANPR data.

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
