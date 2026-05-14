import prisma from '../config/database';
import logger from '../config/logger';
import { config } from '../config';
import fs from 'fs';
import path from 'path';
import { addResumeJob } from '../queues';

type UserContext = { id: string; role: string };

export class ResumeService {
  static async upload(userId: string, file: Express.Multer.File) {
    const resume = await prisma.resume.create({
      data: {
        userId,
        fileName: file.originalname,
        fileUrl: `/uploads/${file.filename}`,
        fileSize: file.size,
      },
    });

    logger.info({ resumeId: resume.id, userId }, 'Resume uploaded');

    // Enqueue AI analysis via BullMQ (non-blocking, with retries)
    addResumeJob({
      resumeId: resume.id,
      fileUrl: resume.fileUrl,
      fileName: resume.fileName,
    }).catch(err => {
      logger.error({ error: err, resumeId: resume.id }, 'Failed to enqueue resume analysis');
    });

    return resume;
  }

  static async getByUserId(userId: string) {
    return prisma.resume.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  static async getByIdForUser(id: string, user: UserContext) {
    const resume = await prisma.resume.findUnique({ where: { id } });
    if (!resume) return null;
    if (user.role === 'ADMIN' || resume.userId === user.id) return resume;
    throw Object.assign(new Error('Access denied'), { status: 403 });
  }

  static async delete(id: string, user: UserContext) {
    const resume = await prisma.resume.findUnique({ where: { id } });

    if (!resume) throw Object.assign(new Error('Resume not found'), { status: 404 });
    if (user.role !== 'ADMIN' && resume.userId !== user.id) {
      throw Object.assign(new Error('Access denied'), { status: 403 });
    }

    // Delete file from disk
    const filePath = path.join(config.upload.dir, path.basename(resume.fileUrl));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.resume.delete({ where: { id } });
    logger.info({ resumeId: id }, 'Resume deleted');
  }

  static async analyzeResume(resumeId: string, user?: UserContext) {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) {
      throw Object.assign(new Error('Resume not found'), { status: 404 });
    }
    if (user && user.role !== 'ADMIN' && resume.userId !== user.id) {
      throw Object.assign(new Error('Access denied'), { status: 403 });
    }

    // Verify file exists before enqueueing
    const filePath = path.join(config.upload.dir, path.basename(resume.fileUrl));
    if (!fs.existsSync(filePath)) {
      throw Object.assign(new Error('Resume file not found on disk'), { status: 404 });
    }

    // Enqueue via BullMQ
    await addResumeJob({
      resumeId: resume.id,
      fileUrl: resume.fileUrl,
      fileName: resume.fileName,
    });

    logger.info({ resumeId }, 'Resume analysis enqueued');
  }
}
