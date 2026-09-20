"""Stdout logging for Render / local uvicorn."""

from __future__ import annotations

import logging
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
    force=True,
)

log = logging.getLogger("sih")
log.setLevel(logging.INFO)


def rss() -> str:
    """Current process RSS, for Render OOM debugging."""
    try:
        with open("/proc/self/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return f"{int(line.split()[1]) / 1024:.0f}MB"
    except Exception:
        pass
    return "?"


def step(msg: str, **kwargs) -> None:
    extra = " ".join(f"{k}={v}" for k, v in kwargs.items())
    suffix = f" | {extra}" if extra else ""
    line = f"{msg}{suffix} | rss={rss()}"
    log.info(line)
    sys.stdout.flush()
