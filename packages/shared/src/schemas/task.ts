import { z } from 'zod';

export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  statusId: z.string().uuid(),
  title: z.string().min(1, 'Task title is required').max(200),
  description: z.string().max(10000).optional(),
  priority: taskPrioritySchema.default('medium'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD format').nullable().optional(),
  assigneeIds: z.array(z.string().uuid()).default([]),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).nullable().optional(),
  statusId: z.string().uuid().optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  position: z.number().int().optional(),
  version: z.number().int().optional(), // Optimistic locking
  assigneeIds: z.array(z.string().uuid()).optional(),
});

export const moveTaskSchema = z.object({
  taskId: z.string().uuid(),
  targetStatusId: z.string().uuid(),
  newPosition: z.number().int(),
  currentVersion: z.number().int(),
});

export const createChecklistItemSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().min(1).max(255),
});

export const toggleChecklistItemSchema = z.object({
  isCompleted: z.boolean(),
});

export const createTaskCommentSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().min(1).max(5000),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;
export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;
