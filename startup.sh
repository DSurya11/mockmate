#!/bin/bash

mkdir -p voices

# MALE
curl -L -o voices/en_US-ryan-high.onnx "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx"
curl -L -o voices/en_US-ryan-high.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx.json"

curl -L -o voices/en_US-joe-medium.onnx "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx"
curl -L -o voices/en_US-joe-medium.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx.json"

curl -L -o voices/en_US-john-medium.onnx "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/john/medium/en_US-john-medium.onnx"
curl -L -o voices/en_US-john-medium.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/john/medium/en_US-john-medium.onnx.json"

# FEMALE
curl -L -o voices/en_US-amy-low.onnx "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/low/en_US-amy-low.onnx"
curl -L -o voices/en_US-amy-low.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/low/en_US-amy-low.onnx.json"

curl -L -o voices/en_US-kathleen-low.onnx "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kathleen/low/en_US-kathleen-low.onnx"
curl -L -o voices/en_US-kathleen-low.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kathleen/low/en_US-kathleen-low.onnx.json"

curl -L -o voices/en_US-kristin-medium.onnx "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kristin/medium/en_US-kristin-medium.onnx"
curl -L -o voices/en_US-kristin-medium.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kristin/medium/en_US-kristin-medium.onnx.json"

echo "Voices downloaded successfully."
