"""
main.py — FastAPI backend for the FlytBase Drone Traffic Analytics app.

Endpoints:
    POST /api/upload          Upload a video file → returns job_id
    GET  /api/status/{id}     SSE stream of tracking progress
    GET  /api/results/{id}    Tracking results (JSON)
    GET  /api/video/{id}      Serve annotated video
    GET  /api/download/{id}   Download tracks.parquet
"""

from __future__ import annotations

import asyncio
import json
import shutil
import time
import uuid
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from config import MAX_SECONDS_DEFAULT, STRIDE_DEFAULT, UPLOAD_DIR, OUTPUT_DIR
from logutil import log, step

app = FastAPI(title="FlytBase Drone Traffic Analytics")

# allow_credentials=True + origins="*" is invalid CORS and browsers drop the header.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.middleware("http")
async def log_every_request(request: Request, call_next):
    t0 = time.time()
    step(
        "HTTP IN",
        method=request.method,
        path=request.url.path,
        query=str(request.url.query or "-"),
        client=(request.client.host if request.client else "-"),
    )
    try:
        response = await call_next(request)
    except Exception:
        log.exception("HTTP FAIL %s %s after %.2fs", request.method, request.url.path, time.time() - t0)
        raise
    step(
        "HTTP OUT",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        ms=round((time.time() - t0) * 1000),
    )
    return response


@app.on_event("startup")
def on_startup():
    step(
        "APP START",
        stride=STRIDE_DEFAULT,
        max_seconds=MAX_SECONDS_DEFAULT,
        upload_dir=UPLOAD_DIR,
        output_dir=OUTPUT_DIR,
    )


jobs: dict[str, dict] = {}


@app.get("/")
@app.get("/health")
def health():
    """Render health check — must not import PyTorch."""
    step("CALL health")
    return {"ok": True, "service": "flytbase-traffic"}


@app.post("/api/upload")
@app.post("/upload")
async def upload_video(video: UploadFile = File(...)):
    """Accept a video upload and start a tracking job."""
    job_id = str(uuid.uuid4())[:8]
    step("CALL upload", job_id=job_id, filename=video.filename, content_type=video.content_type)

    upload_dir = UPLOAD_DIR / job_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    video_path = upload_dir / (video.filename or "upload.mp4")

    with open(video_path, "wb") as f:
        shutil.copyfileobj(video.file, f)
    size_mb = video_path.stat().st_size / (1024 * 1024)
    step("STEP saved upload", job_id=job_id, path=video_path, size_mb=round(size_mb, 2))

    out_dir = OUTPUT_DIR / job_id
    out_dir.mkdir(parents=True, exist_ok=True)

    jobs[job_id] = {
        "status": "queued",
        "video_path": str(video_path),
        "out_dir": str(out_dir),
        "filename": video.filename,
        "progress": [],
        "result": None,
        "error": None,
    }
    step("STEP job queued", job_id=job_id, active_jobs=len(jobs))

    asyncio.get_event_loop().run_in_executor(None, _run_job, job_id)
    step("STEP executor started", job_id=job_id)

    return {"job_id": job_id, "filename": video.filename}


def _run_job(job_id: str):
    """Execute the tracking pipeline (runs in a thread)."""
    job = jobs[job_id]
    job["status"] = "running"
    step("STEP job running", job_id=job_id, video=job["video_path"])

    def on_progress(p: dict):
        job["progress"].append(p)
        step(
            "STEP progress",
            job_id=job_id,
            processed=p.get("processed"),
            total=p.get("total"),
            fps=p.get("fps"),
            eta_s=p.get("eta_s"),
            t=p.get("timestamp_s"),
        )

    try:
        step("STEP import tracker+analytics (loads torch)", job_id=job_id)
        from tracker import run_tracking
        from analytics import class_summary, track_summaries, speed_estimate_px, overview_stats
        step("STEP imports done", job_id=job_id)

        result = run_tracking(
            video_path=Path(job["video_path"]),
            out_dir=Path(job["out_dir"]),
            stride=STRIDE_DEFAULT,
            max_seconds=MAX_SECONDS_DEFAULT,
            annotate_seconds=9999,
            on_progress=on_progress,
        )
        step(
            "STEP tracking returned",
            job_id=job_id,
            tracks=result.get("unique_tracks"),
            dets=result.get("total_detections"),
        )

        parquet_path = Path(result["parquet_path"])
        if parquet_path.exists():
            step("STEP load parquet analytics", job_id=job_id, parquet=parquet_path)
            df = pd.read_parquet(parquet_path)
            source_fps = result["source_fps"]
            stride = STRIDE_DEFAULT
            step("STEP parquet loaded", job_id=job_id, rows=len(df))

            trajectories = {}
            if not df.empty and "track_id" in df.columns:
                valid_df = df[df["track_id"] >= 0].sort_values(["track_id", "timestamp_s"])
                try:
                    res_parts = str(result.get("source_resolution", "3840x2160")).split("x")
                    w, h = float(res_parts[0]), float(res_parts[1])
                except Exception:
                    w, h = 3840.0, 2160.0

                for tid, gdf in valid_df.groupby("track_id"):
                    trajectories[int(tid)] = {
                        "t": [round(float(t), 2) for t in gdf["timestamp_s"]],
                        "box": [
                            [
                                round(float(r.x1) / w, 4),
                                round(float(r.y1) / h, 4),
                                round(float(r.x2) / w, 4),
                                round(float(r.y2) / h, 4),
                            ]
                            for r in gdf.itertuples()
                        ],
                        "speed": [
                            round(float(s), 1) if pd.notna(s) else 0.0
                            for s in (gdf["speed_kmh"] if "speed_kmh" in gdf.columns else [0] * len(gdf))
                        ],
                    }

            analytics = {
                "overview": overview_stats(df, source_fps, stride, result["duration_s"]),
                "class_summary": class_summary(df),
                "track_summaries": track_summaries(df, source_fps, stride)[:150],
                "speed_estimates": speed_estimate_px(df, source_fps, stride)[:50],
                "trajectories": trajectories,
            }
            result["analytics"] = analytics
            step("STEP analytics attached", job_id=job_id, n_trajectories=len(trajectories))

        job["result"] = result
        job["status"] = "done"
        step("STEP job done", job_id=job_id)
    except Exception as e:
        log.exception("STEP job error job_id=%s", job_id)
        job["error"] = str(e)
        job["status"] = "error"


@app.get("/api/status/{job_id}")
@app.get("/status/{job_id}")
async def job_status_sse(job_id: str):
    """Server-Sent Events stream for real-time progress."""
    step("CALL status SSE", job_id=job_id, known=job_id in jobs)
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_stream():
        seen = 0
        step("STEP SSE open", job_id=job_id)
        while True:
            job = jobs[job_id]
            while seen < len(job["progress"]):
                data = json.dumps(job["progress"][seen])
                step("STEP SSE progress event", job_id=job_id, index=seen)
                yield f"event: progress\ndata: {data}\n\n"
                seen += 1

            if job["status"] == "done":
                step("STEP SSE done", job_id=job_id)
                yield f"event: done\ndata: {json.dumps(job['result'])}\n\n"
                break
            elif job["status"] == "error":
                step("STEP SSE error", job_id=job_id, error=job["error"])
                yield f"event: error\ndata: {json.dumps({'error': job['error']})}\n\n"
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/results/{job_id}")
@app.get("/results/{job_id}")
async def get_results(job_id: str):
    """Return full tracking results with analytics."""
    step("CALL results", job_id=job_id, known=job_id in jobs)
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    step("STEP results status", job_id=job_id, status=job["status"])
    if job["status"] != "done":
        return {"status": job["status"], "error": job.get("error")}

    from analytics import class_summary, track_summaries, speed_estimate_px, overview_stats

    result = job["result"]
    parquet_path = Path(result["parquet_path"])
    df = pd.read_parquet(parquet_path)
    source_fps = result["source_fps"]
    stride = STRIDE_DEFAULT
    step("STEP results parquet", job_id=job_id, rows=len(df))

    trajectories = {}
    if not df.empty and "track_id" in df.columns:
        valid_df = df[df["track_id"] >= 0].sort_values(["track_id", "timestamp_s"])
        try:
            res_parts = str(result.get("source_resolution", "3840x2160")).split("x")
            w, h = float(res_parts[0]), float(res_parts[1])
        except Exception:
            w, h = 3840.0, 2160.0

        for tid, gdf in valid_df.groupby("track_id"):
            trajectories[int(tid)] = {
                "t": [round(float(t), 2) for t in gdf["timestamp_s"]],
                "box": [
                    [
                        round(float(r.x1) / w, 4),
                        round(float(r.y1) / h, 4),
                        round(float(r.x2) / w, 4),
                        round(float(r.y2) / h, 4),
                    ]
                    for r in gdf.itertuples()
                ],
                "speed": [
                    round(float(s), 1) if pd.notna(s) else 0.0
                    for s in (gdf["speed_kmh"] if "speed_kmh" in gdf.columns else [0] * len(gdf))
                ],
            }

    analytics = {
        "overview": overview_stats(df, source_fps, stride, result["duration_s"]),
        "class_summary": class_summary(df),
        "track_summaries": track_summaries(df, source_fps, stride)[:150],
        "speed_estimates": speed_estimate_px(df, source_fps, stride)[:50],
        "trajectories": trajectories,
    }
    step("STEP results ready", job_id=job_id, n_trajectories=len(trajectories))

    return {
        "status": "done",
        "job_id": job_id,
        "filename": job["filename"],
        **result,
        "analytics": analytics,
    }


@app.get("/api/video/{job_id}")
@app.get("/video/{job_id}")
async def serve_video(job_id: str):
    """Serve the annotated video."""
    step("CALL video", job_id=job_id)
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    if job["status"] != "done":
        step("STEP video not ready", job_id=job_id, status=job["status"])
        raise HTTPException(status_code=400, detail="Job not done yet")

    video_path = Path(job["result"]["video_path"])
    if not video_path.exists():
        step("STEP video missing", job_id=job_id, path=video_path)
        raise HTTPException(status_code=404, detail="Annotated video not found")

    step("STEP video send", job_id=job_id, path=video_path)
    return FileResponse(
        str(video_path), media_type="video/mp4", filename="tracks_annotated.mp4"
    )


@app.get("/api/download/{job_id}")
@app.get("/download/{job_id}")
async def download_parquet(job_id: str):
    """Download the tracks parquet file."""
    step("CALL download", job_id=job_id)
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    if job["status"] != "done":
        raise HTTPException(status_code=400, detail="Job not done yet")

    parquet_path = Path(job["result"]["parquet_path"])
    if not parquet_path.exists():
        raise HTTPException(status_code=404, detail="Parquet file not found")

    step("STEP parquet send", job_id=job_id, path=parquet_path)
    return FileResponse(
        str(parquet_path),
        media_type="application/octet-stream",
        filename="tracks.parquet",
    )


@app.get("/api/jobs")
@app.get("/jobs")
async def list_jobs():
    """List all jobs and their status."""
    step("CALL list_jobs", count=len(jobs))
    return {
        jid: {
            "status": j["status"],
            "filename": j["filename"],
        }
        for jid, j in jobs.items()
    }
