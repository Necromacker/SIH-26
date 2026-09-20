"""
Hugging Face ZeroGPU Space — same tracker logic as local FastAPI.
"""

from __future__ import annotations

import os

# Must be imported before Gradio / CUDA libraries on ZeroGPU.
import spaces

os.environ.setdefault("YOLO_CONFIG_DIR", "/tmp/Ultralytics")

import json
import sys
import tempfile
from pathlib import Path

import gradio as gr
import pandas as pd

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

from tracker import run_tracking  # noqa: E402
from analytics import overview_stats, class_summary  # noqa: E402


@spaces.GPU(duration=120)
def process_video(video_path: str | None):
    if not video_path:
        raise gr.Error("Upload a short traffic clip first (under ~30 seconds).")

    out_dir = Path(tempfile.mkdtemp(prefix="sih_"))
    result = run_tracking(
        video_path=Path(video_path),
        out_dir=out_dir,
        stride=5,
        max_seconds=30,
        annotate_seconds=9999,
    )

    parquet_path = Path(result["parquet_path"])
    extra = {}
    if parquet_path.exists():
        df = pd.read_parquet(parquet_path)
        extra = {
            "overview": overview_stats(df, result["source_fps"], 5, result["duration_s"]),
            "class_summary": class_summary(df),
        }

    summary = {
        "unique_tracks": result.get("unique_tracks"),
        "total_detections": result.get("total_detections"),
        "duration_s": result.get("duration_s"),
        "source_resolution": result.get("source_resolution"),
        "device": result.get("device"),
        "class_breakdown": result.get("class_breakdown"),
        **extra,
    }
    return result["video_path"], json.dumps(summary, indent=2, default=str)


with gr.Blocks(title="Drone Traffic Analytics") as demo:
    gr.Markdown(
        "# Drone Traffic Analytics\n"
        "Same VisDrone YOLOv11s + ByteTrack pipeline as the local app. "
        "Use a **short** clip (≤30s). First run downloads `best.pt` and can take a few minutes."
    )
    with gr.Row():
        inp = gr.Video(label="Traffic video", sources=["upload"])
        out_video = gr.Video(label="Annotated tracks")
    out_json = gr.Textbox(label="Analytics", lines=22, max_lines=40)
    btn = gr.Button("Run tracking", variant="primary")
    btn.click(fn=process_video, inputs=inp, outputs=[out_video, out_json])

demo.queue()

if __name__ == "__main__":
    demo.launch(
        server_name="0.0.0.0",
        server_port=int(os.environ.get("PORT", 7860)),
        show_error=True,
    )
