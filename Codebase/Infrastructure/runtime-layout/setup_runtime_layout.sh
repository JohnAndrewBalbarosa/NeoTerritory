#!/usr/bin/env sh
set -eu

TARGET_DIR="${1:-$(pwd)}"
CREATE_PLACEHOLDERS="${2:-}"

RUNTIME_ROOT="$(cd "$TARGET_DIR" && pwd)"
INPUT_DIR="$RUNTIME_ROOT/Input"
OUTPUT_DIR="$RUNTIME_ROOT/Output"
ANALYSIS_DIR="$OUTPUT_DIR/analysis_report"
GENERATED_CODE_DIR="$OUTPUT_DIR/generated_code"
HTML_DIR="$OUTPUT_DIR/html"

mkdir -p "$INPUT_DIR" "$OUTPUT_DIR" "$ANALYSIS_DIR" "$GENERATED_CODE_DIR" "$HTML_DIR"

INPUT_README_PATH="$INPUT_DIR/README.md"
if [ ! -f "$INPUT_README_PATH" ]; then
  cat > "$INPUT_README_PATH" <<'EOF'
# NeoTerritory Input Folder

Place C/C++ source files here before running the executable.

Supported file extensions:
- .cpp
- .hpp
- .h
- .cc
- .cxx

Notes:
- The runtime scanner reads top-level files only (non-recursive).
- Output artifacts are written under ../Output.
EOF
fi

if [ "$CREATE_PLACEHOLDERS" = "--placeholders" ]; then
  : > "$ANALYSIS_DIR/.gitkeep"
  : > "$GENERATED_CODE_DIR/.gitkeep"
  : > "$HTML_DIR/.gitkeep"
fi

echo "Runtime layout prepared at: $RUNTIME_ROOT"
