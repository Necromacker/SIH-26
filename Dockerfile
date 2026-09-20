FROM python:3.11-slim

ENV PORT=7860 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    LOW_MEMORY=0 \
    MAX_VIDEO_SECONDS=0 \
    TRACK_STRIDE=5 \
    DATA_DIR=/home/user/app/data \
    HF_HOME=/home/user/.cache/huggingface

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 user

WORKDIR /home/user/app

COPY backend/requirements-render.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r /tmp/requirements.txt

COPY --chown=user:user backend/ /home/user/app/

RUN mkdir -p /home/user/app/data/uploads /home/user/app/data/output \
        /home/user/.cache/huggingface \
    && python -c "from huggingface_hub import hf_hub_download; hf_hub_download(repo_id='dronefreak/visdrone-yolov11s', filename='best.pt')" \
    && chown -R user:user /home/user

USER user

EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
