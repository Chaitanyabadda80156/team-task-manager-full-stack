import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(100),
  role: z.enum(['Admin', 'Member']).default('Member')
});

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1)
});

export const projectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).default('')
});

export const memberSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user id.')
});

export const taskSchema = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(1000).default(''),
  assigneeId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid assignee id.').nullable().optional(),
  status: z.enum(['Todo', 'In Progress', 'Done']).default('Todo'),
  priority: z.enum(['Low', 'Medium', 'High']).default('Medium'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format.')
});

export const taskUpdateSchema = taskSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'Provide at least one task field.'
});

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        message: 'Validation failed.',
        errors: result.error.flatten().fieldErrors
      });
    }

    req.validated = result.data;
    return next();
  };
}
