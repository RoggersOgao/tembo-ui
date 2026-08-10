import { z } from 'zod';

// ── Enums (mirrored from Prisma schema) ──────────────────────────────────────
export type CommentEntityType = 'PRODUCT' | 'ORDER' | 'REVIEW';

export type CommentStatus = 'PUBLISHED' | 'PENDING_MODERATION' | 'FLAGGED' | 'HIDDEN' | 'DELETED';


export const CommentEntityTypeSchema = z.enum(['PRODUCT', 'ORDER', 'REVIEW']);

const VoteTypeSchema = z.enum(['UP', 'DOWN']);

const ReportReasonSchema = z.enum([
  'SPAM',
  'FAKE_REVIEW',
  'INAPPROPRIATE',
  'WRONG_PRODUCT',
  'QUALITY_ISSUE',
  'OTHER',
]);

const ReviewStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'FLAGGED',
  'REMOVED',
]);

// ── Comment Schemas ───────────────────────────────────────────────────────────

export const CreateCommentSchema = z.object({
  body: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(5000, 'Comment too long (max 5000 characters)')
    .trim(),
  entityType: CommentEntityTypeSchema,
  productId: z.string().optional(),
  reviewId: z.string().optional(),
  parentId: z.string().optional(),
}).refine(
  (data) => {
    if (data.entityType === 'PRODUCT') return !!data.productId;
    if (data.entityType === 'REVIEW') return !!data.reviewId;
    return true; // ORDER comments don't need a productId/reviewId
  },
  {
    message: 'productId is required for PRODUCT comments; reviewId is required for REVIEW comments',
    path: ['entityType'],
  }
);

export const UpdateCommentSchema = z.object({
  body: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(5000, 'Comment too long (max 5000 characters)')
    .trim(),
});

export const CommentQuerySchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional()
    .default('1'),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional()
    .default('20'),
  sortBy: z
    .enum(['newest', 'oldest', 'top', 'controversial'])
    .optional()
    .default('newest'),
  parentId: z.string().optional(),
  cursor: z.string().optional(),
  entityType: CommentEntityTypeSchema.optional(),
  productId: z.string().optional(),
  reviewId: z.string().optional(),
});

export const CommentParamsSchema = z.object({
  id: z.string().min(1, 'Comment ID is required'),
});

export const ProductCommentsParamsSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
});

export const VoteCommentSchema = z.object({
  voteType: VoteTypeSchema,
});

export const ReportCommentSchema = z.object({
  reason: ReportReasonSchema,
  details: z.string().max(1000).optional(),
});

// ── Review Schemas ────────────────────────────────────────────────────────────

export const CreateReviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1, 'Rating must be at least 1 star')
    .max(5, 'Rating cannot exceed 5 stars'),
  title: z.string().max(255, 'Title too long (max 255 characters)').trim().optional(),
  body: z
    .string()
    .max(2000, 'Review too long (max 2000 characters)')
    .trim()
    .optional(),
  images: z.array(z.string().url('Each image must be a valid URL')).optional(),
  orderId: z.string().optional(),
});

export const UpdateReviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1, 'Rating must be at least 1 star')
    .max(5, 'Rating cannot exceed 5 stars')
    .optional(),
  title: z.string().max(255).trim().optional(),
  body: z.string().max(2000).trim().optional(),
  images: z.array(z.string().url()).optional(),
});

export const ReviewQuerySchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional()
    .default('1'),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .optional()
    .default('10'),
  rating: z
    .string()
    .regex(/^[1-5]$/)
    .transform(Number)
    .optional(),
  sortBy: z
    .enum(['newest', 'oldest', 'highest', 'lowest', 'most_helpful'])
    .optional()
    .default('newest'),
  status: ReviewStatusSchema.optional(),
  isVerified: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  isFeatured: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export const ReviewParamsSchema = z.object({
  id: z.string().min(1, 'Review ID is required'),
});

export const ProductReviewParamsSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
});

export const VoteReviewSchema = z.object({
  helpful: z.boolean(),
});

export const ModerateReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'FLAGGED', 'REMOVED']),
});

// ── Type Exports ──────────────────────────────────────────────────────────────

// Comments
export type CreateCommentDTO = z.infer<typeof CreateCommentSchema>;
export type UpdateCommentDTO = z.infer<typeof UpdateCommentSchema>;
export type CommentQueryDTO = z.infer<typeof CommentQuerySchema>;
export type CommentParamsDTO = z.infer<typeof CommentParamsSchema>;
export type ProductCommentsParamsDTO = z.infer<typeof ProductCommentsParamsSchema>;
export type VoteCommentDTO = z.infer<typeof VoteCommentSchema>;
export type ReportCommentDTO = z.infer<typeof ReportCommentSchema>;

// Reviews
export type CreateReviewDTO = z.infer<typeof CreateReviewSchema>;
export type UpdateReviewDTO = z.infer<typeof UpdateReviewSchema>;
export type ReviewQueryDTO = z.infer<typeof ReviewQuerySchema>;
export type ReviewParamsDTO = z.infer<typeof ReviewParamsSchema>;
export type ProductReviewParamsDTO = z.infer<typeof ProductReviewParamsSchema>;
export type VoteReviewDTO = z.infer<typeof VoteReviewSchema>;
export type ModerateReviewDTO = z.infer<typeof ModerateReviewSchema>;