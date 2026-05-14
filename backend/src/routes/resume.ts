import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ResumeService } from '../services/resumeService';
import { config } from '../config';
import { validateParams } from '../middleware/validate';
import fs from 'fs';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.upload.dir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

const idParamSchema = z.object({ id: z.string().uuid() });

async function ensurePdfSignature(filePath: string) {
  const fd = await fs.promises.open(filePath, 'r');
  const buffer = Buffer.alloc(4);
  await fd.read(buffer, 0, 4, 0);
  await fd.close();
  if (buffer.toString() !== '%PDF') {
    throw new Error('Invalid PDF file');
  }
}

router.post('/', authenticate, upload.single('resume'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Resume file is required' });
    if (req.user!.role !== 'CANDIDATE' && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Candidate access required' });
    }
    try {
      await ensurePdfSignature(req.file.path);
    } catch (error: any) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: error.message || 'Invalid PDF file' });
    }
    const resume = await ResumeService.upload(req.user!.id, req.file);
    res.status(201).json(resume);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const resumes = await ResumeService.getByUserId(req.user!.id);
    res.json(resumes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticate, validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const resume = await ResumeService.getByIdForUser(req.params.id as string, req.user!);
    if (!resume) return res.status(404).json({ error: 'Resume not found' });
    res.json(resume);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/:id/download', authenticate, validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const resume = await ResumeService.getByIdForUser(req.params.id as string, req.user!);
    if (!resume) return res.status(404).json({ error: 'Resume not found' });
    const filePath = path.join(config.upload.dir, path.basename(resume.fileUrl));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.download(filePath, resume.fileName);
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.delete('/:id', authenticate, validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    await ResumeService.delete(req.params.id as string, req.user!);
    res.json({ message: 'Resume deleted' });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/:id/analyze', authenticate, validateParams(idParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    await ResumeService.analyzeResume(req.params.id as string, req.user!);
    res.json({ message: 'Analysis started' });
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
