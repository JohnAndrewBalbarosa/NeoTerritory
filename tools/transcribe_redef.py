#!/usr/bin/env python3
"""Transcribe a (Taglish) audio file to verbatim, timestamped captions.

Built for `Redef.m4a` voice notes but works on any audio ffmpeg can read.
Uses faster-whisper (CTranslate2) so it runs offline on CPU with no API key.

Output is intentionally VERBATIM:
  * task="transcribe" (never "translate") so Taglish code-switching is kept
    exactly as spoken instead of being forced into pure English.

Two artifacts are written incrementally (so a long run leaves partial output
and progress can be watched live):
  * <out>.srt              -- standard subtitle file, segment-level timestamps
  * <out>.transcript.md    -- readable [hh:mm:ss-hh:mm:ss] verbatim blocks

Usage:
  python tools/transcribe_redef.py INPUT.wav --out Redef \
      [--model large-v3] [--language tl|en|auto] [--beam-size 5]
"""
from __future__ import annotations

import argparse
import datetime as _dt
import sys
import time
from pathlib import Path


def _fmt_srt(seconds: float) -> str:
    """HH:MM:SS,mmm for SRT cues."""
    if seconds < 0:
        seconds = 0.0
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _fmt_clock(seconds: float) -> str:
    """MM:SS, or H:MM:SS once the audio passes an hour, for the markdown view."""
    if seconds < 0:
        seconds = 0.0
    total = int(round(seconds))
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("input", help="audio file (wav/m4a/mp3/...) to transcribe")
    ap.add_argument("--out", default="Redef",
                    help="output basename; writes <out>.srt and <out>.transcript.md")
    ap.add_argument("--model", default="large-v3", help="faster-whisper model size")
    ap.add_argument("--language", default="auto",
                    help='language code (e.g. "tl", "en") or "auto" to detect')
    ap.add_argument("--beam-size", type=int, default=5,
                    help="beam width; drop to 1 for a faster CPU run")
    ap.add_argument("--compute-type", default="int8",
                    help="CTranslate2 compute type (int8 is the CPU default)")
    ap.add_argument("--no-condition", action="store_true",
                    help="disable condition_on_previous_text (use if it loops/repeats)")
    args = ap.parse_args()

    # Imported here so --help works even before the package is installed.
    from faster_whisper import WhisperModel

    in_path = Path(args.input)
    if not in_path.exists():
        print(f"ERROR: input not found: {in_path}", file=sys.stderr)
        return 2

    srt_path = Path(f"{args.out}.srt")
    md_path = Path(f"{args.out}.transcript.md")
    language = None if args.language.lower() == "auto" else args.language

    print(f"[load] model={args.model} compute_type={args.compute_type} device=cpu",
          flush=True)
    t0 = time.time()
    model = WhisperModel(args.model, device="cpu", compute_type=args.compute_type)
    print(f"[load] ready in {time.time() - t0:.1f}s", flush=True)

    print(f"[run]  transcribing {in_path.name} (verbatim, no translation)...",
          flush=True)
    t1 = time.time()
    segments, info = model.transcribe(
        str(in_path),
        task="transcribe",
        language=language,
        beam_size=args.beam_size,
        vad_filter=True,  # Silero VAD trims silence + curbs repeat hallucinations
        condition_on_previous_text=not args.no_condition,
    )
    print(f"[lang] detected={info.language} p={info.language_probability:.2f} "
          f"audio={_fmt_clock(info.duration)}", flush=True)

    generated = _dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    srt = srt_path.open("w", encoding="utf-8")
    md = md_path.open("w", encoding="utf-8")
    md.write(f"# Transcript — {in_path.name}\n\n")
    md.write(f"> Verbatim timestamped captions. model `{args.model}` · "
             f"detected language `{info.language}` "
             f"(p={info.language_probability:.2f}) · generated {generated}.\n")
    md.write("> Taglish is preserved as spoken (no translation).\n\n")
    md.flush()

    count = 0
    for seg in segments:
        count += 1
        text = seg.text.strip()
        # SRT cue
        srt.write(f"{count}\n{_fmt_srt(seg.start)} --> {_fmt_srt(seg.end)}\n{text}\n\n")
        srt.flush()
        # Markdown block
        md.write(f"**[{_fmt_clock(seg.start)}–{_fmt_clock(seg.end)}]** {text}\n\n")
        md.flush()
        # Live progress to stdout so the run rate is observable
        print(f"[{_fmt_clock(seg.start)}–{_fmt_clock(seg.end)}] {text}", flush=True)

    srt.close()
    md.close()
    elapsed = time.time() - t1
    rt = (info.duration / elapsed) if elapsed > 0 else 0.0
    print(f"\n[done] {count} segments in {elapsed:.1f}s "
          f"({rt:.2f}x realtime) -> {srt_path.name}, {md_path.name}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
