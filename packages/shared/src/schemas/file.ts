import { z } from 'zod';

export const ALLOWED_MIME_TYPES = {
  // Images
  'image/jpeg': { ext: 'jpg', category: 'image', maxSize: 5 * 1024 * 1024 }, // 5 MB
  'image/png': { ext: 'png', category: 'image', maxSize: 5 * 1024 * 1024 },
  'image/webp': { ext: 'webp', category: 'image', maxSize: 5 * 1024 * 1024 },
  'image/gif': { ext: 'gif', category: 'image', maxSize: 5 * 1024 * 1024 },

  // Audio / Voice notes
  'audio/webm': { ext: 'webm', category: 'audio', maxSize: 20 * 1024 * 1024 }, // 20 MB
  'audio/mpeg': { ext: 'mp3', category: 'audio', maxSize: 20 * 1024 * 1024 },
  'audio/mp4': { ext: 'm4a', category: 'audio', maxSize: 20 * 1024 * 1024 },
  'audio/wav': { ext: 'wav', category: 'audio', maxSize: 20 * 1024 * 1024 },
  'audio/ogg': { ext: 'ogg', category: 'audio', maxSize: 20 * 1024 * 1024 },

  // Documents
  'application/pdf': { ext: 'pdf', category: 'document', maxSize: 15 * 1024 * 1024 }, // 15 MB
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    ext: 'docx',
    category: 'document',
    maxSize: 15 * 1024 * 1024,
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    ext: 'xlsx',
    category: 'document',
    maxSize: 15 * 1024 * 1024,
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    ext: 'pptx',
    category: 'document',
    maxSize: 15 * 1024 * 1024,
  },
  'text/plain': { ext: 'txt', category: 'document', maxSize: 5 * 1024 * 1024 },
  'text/csv': { ext: 'csv', category: 'document', maxSize: 5 * 1024 * 1024 },

  // Video / Meeting Recordings
  'video/mp4': { ext: 'mp4', category: 'recording', maxSize: 50 * 1024 * 1024 }, // 50 MB
  'video/webm': { ext: 'webm', category: 'recording', maxSize: 50 * 1024 * 1024 },
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_MIME_TYPES;

export const uploadRequestSchema = z.object({
  projectId: z.string().uuid(),
  originalName: z.string().min(1).max(255),
  contentType: z.string().refine((val): val is AllowedMimeType => val in ALLOWED_MIME_TYPES, {
    message: 'File type is not permitted. Only standard images, audio, documents, and videos are allowed.',
  }),
  sizeBytes: z.number().positive(),
  taskId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
});

export type UploadRequestInput = z.infer<typeof uploadRequestSchema>;
