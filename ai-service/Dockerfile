FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Create voices directory and download voice models
RUN mkdir -p /app/voices

# Install ffmpeg for faster-whisper audio decoding and curl for voice downloads
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl && \
    curl --retry 3 --retry-delay 5 -L -o /app/voices/en_US-ryan-high.onnx \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx" && \
    curl --retry 3 --retry-delay 5 -L -o /app/voices/en_US-ryan-high.onnx.json \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/en_US-ryan-high.onnx.json" && \
    curl --retry 3 --retry-delay 5 -L -o /app/voices/en_US-joe-medium.onnx \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx" && \
    curl --retry 3 --retry-delay 5 -L -o /app/voices/en_US-joe-medium.onnx.json \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/en_US-joe-medium.onnx.json" && \
    curl --retry 3 --retry-delay 5 -L -o /app/voices/en_US-amy-low.onnx \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/low/en_US-amy-low.onnx" && \
    curl --retry 3 --retry-delay 5 -L -o /app/voices/en_US-amy-low.onnx.json \
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/low/en_US-amy-low.onnx.json" && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Pre-download Whisper base model so it's cached in the image layer (no runtime download lag)
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8'); print('Whisper base model cached.')"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
