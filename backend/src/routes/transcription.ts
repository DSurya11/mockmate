import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { config } from '../config';

const router = Router();
const TRANSCRIPTION_MAX_SIZE = 50 * 1024 * 1024; // 50 MB — safe ceiling for long audio
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TRANSCRIPTION_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg', 'audio/mp3', 'video/webm'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio type: ${file.mimetype}`));
    }
  },
});

router.post('/', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    // Determine MIME type based on file extension
    let mimeType = req.file.mimetype || 'audio/wav';
    if (!mimeType.startsWith('audio/') && !mimeType.startsWith('video/')) {
      // Fallback based on filename extension
      if (req.file.originalname?.endsWith('.wav')) mimeType = 'audio/wav';
      else if (req.file.originalname?.endsWith('.mp3')) mimeType = 'audio/mpeg';
      else if (req.file.originalname?.endsWith('.webm')) mimeType = 'audio/webm';
      else if (req.file.originalname?.endsWith('.m4a')) mimeType = 'audio/mp4';
      else mimeType = 'audio/wav'; // Default to WAV
    }

    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array(req.file.buffer)], { type: mimeType }),
      req.file.originalname || 'recording.wav'
    );

    const aiServiceUrl = config.aiService.url;
    const response = await fetch(`${aiServiceUrl}/api/transcribe/`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      signal: AbortSignal.timeout(30_000), // 30 s — allows Whisper base model first-run download
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ error: data.detail || data.error || 'Transcription failed' });
    }

    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Transcription failed' });
  }
});

export default router;