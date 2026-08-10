// lib/comments.api.ts
import { Comment } from '@/hooks/zustand/stores/use-comment-store';
import {
  ApiResponse,
  ErrorCode,
  createSuccessResponse,
  createErrorResponse,
} from '@repo/api-utils';
import { getToken } from './get-token';

import type {
  CreateCommentDTO,
  UpdateCommentDTO,
  VoteCommentDTO,
  ReportCommentDTO,
} from '@/components/schemas/comment-schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommentsListData {
  comments: Comment[];
  hasMore: boolean;
  totalCount: number;
  page: number;
}

export interface VoteData {
  upvoteCount: number;
  downvoteCount: number;
  userVote: 'UP' | 'DOWN' | null;
}

export interface FetchCommentsParams {
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'top' | 'controversial';
  parentId?: string;
  cursor?: string;
}

export type CommentsResponse = ApiResponse<CommentsListData>;
export type CommentResponse  = ApiResponse<Comment>;
export type VoteResponse     = ApiResponse<VoteData>;
export type ReportResponse   = ApiResponse<null>;

// ─── Client ───────────────────────────────────────────────────────────────────

class CommentClient {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private transformComment(comment: any): Comment {
    return {
      ...comment,
      createdAt: new Date(comment.createdAt),
      updatedAt: new Date(comment.updatedAt),
      deletedAt: comment.deletedAt ? new Date(comment.deletedAt) : null,
      lastEditedAt: comment.lastEditedAt ? new Date(comment.lastEditedAt) : null,
      editDeadline: comment.editDeadline ? new Date(comment.editDeadline) : null,
      replies: comment.replies?.map((reply: any) => this.transformComment(reply)),
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth = true,
  ): Promise<T> {
    let token: string | undefined | null;

    if (requireAuth) {
      token = await getToken();
      if (!token) {
        throw new Error('Authorization token is missing. Please log in.');
      }
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const res = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401) throw new Error('Unauthorized');

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(
        errorData.message || errorData.error || `Request failed with status ${res.status}`,
      );
    }

    if (options.method === 'DELETE') {
      const text = await res.text();
      return (text ? JSON.parse(text) : {}) as T;
    }

    return res.json();
  }

  private getClientId(): string {
    if (typeof window === 'undefined') return '';
    let clientId = sessionStorage.getItem('socket-client-id');
    if (!clientId) {
      clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('socket-client-id', clientId);
    }
    return clientId;
  }

  private handleError<T>(error: unknown): ApiResponse<T> {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return createErrorResponse<T>(ErrorCode.UNAUTHORIZED, 'Unauthorized');
      }
      if (error.message.includes('Authorization token is missing')) {
        return createErrorResponse<T>(ErrorCode.UNAUTHORIZED, error.message);
      }
      if (
        error.message.toLowerCase().includes('network') ||
        error.message.includes('fetch')
      ) {
        return createErrorResponse<T>(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Network error: Unable to reach the server',
        );
      }
      return createErrorResponse<T>(ErrorCode.INTERNAL_ERROR, error.message);
    }
    return createErrorResponse<T>(ErrorCode.INTERNAL_ERROR, 'An unexpected error occurred');
  }

  // ── API methods ──────────────────────────────────────────────────────────────

  async fetchComments(
    productId: string,
    params: FetchCommentsParams = {},
  ): Promise<CommentsResponse> {
    try {
      const { page = 1, limit = 20, sortBy = 'newest', parentId, cursor } = params;

      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        ...(parentId ? { parentId } : {}),
        ...(cursor ? { cursor } : {}),
      });

      const response = await this.request<{ data: CommentsListData; message?: string }>(
        `/api/comments/products/${productId}/comments?${query}`,
        {},
        false,
      );

      return createSuccessResponse(
        {
          ...response.data,
          comments: response.data.comments.map((c) => this.transformComment(c)),
        },
        response.message ?? 'Comments retrieved successfully',
      );
    } catch (error) {
      return this.handleError<CommentsListData>(error);
    }
  }

  async createComment(
    productId: string,
    payload: CreateCommentDTO,
  ): Promise<CommentResponse> {
    try {
      const response = await this.request<{ data: Comment; message?: string }>(
        `/api/comments/products/${productId}/comments`,
        {
          method: 'POST',
          headers: { 'X-Client-Id': this.getClientId() },
          // body matches CreateCommentDTO: { body, entityType, productId?, reviewId?, parentId? }
          body: JSON.stringify(payload),
        },
      );

      return createSuccessResponse(
        this.transformComment(response.data),
        response.message ?? 'Comment created successfully',
      );
    } catch (error) {
      return this.handleError<Comment>(error);
    }
  }

  async updateComment(
    commentId: string,
    payload: UpdateCommentDTO,
  ): Promise<CommentResponse> {
    try {
      const response = await this.request<{ data: Comment; message?: string }>(
        `/api/comments/${commentId}`,
        {
          method: 'PUT',
          headers: { 'X-Client-Id': this.getClientId() },
          // body matches UpdateCommentDTO: { body }
          body: JSON.stringify(payload),
        },
      );

      return createSuccessResponse(
        this.transformComment(response.data),
        response.message ?? 'Comment updated successfully',
      );
    } catch (error) {
      return this.handleError<Comment>(error);
    }
  }

  async deleteComment(commentId: string): Promise<ApiResponse<null>> {
    try {
      await this.request<void>(
        `/api/comments/${commentId}`,
        {
          method: 'DELETE',
          headers: { 'X-Client-Id': this.getClientId() },
        },
      );

      return createSuccessResponse(null, 'Comment deleted successfully');
    } catch (error) {
      return this.handleError<null>(error);
    }
  }

  /** Cast a vote (UP or DOWN) on a comment */
  async voteComment(
    commentId: string,
    payload: VoteCommentDTO,
  ): Promise<VoteResponse> {
    try {
      const response = await this.request<{ data: VoteData; message?: string }>(
        `/api/comments/${commentId}/vote`,
        {
          method: 'POST',
          headers: { 'X-Client-Id': this.getClientId() },
          // body matches VoteCommentDTO: { voteType: 'UP' | 'DOWN' }
          body: JSON.stringify(payload),
        },
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Vote recorded successfully',
      );
    } catch (error) {
      return this.handleError<VoteData>(error);
    }
  }

  /** Remove an existing vote from a comment */
  async removeVote(commentId: string): Promise<VoteResponse> {
    try {
      const response = await this.request<{ data: VoteData; message?: string }>(
        `/api/comments/${commentId}/vote`,
        {
          method: 'DELETE',
          headers: { 'X-Client-Id': this.getClientId() },
        },
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Vote removed successfully',
      );
    } catch (error) {
      return this.handleError<VoteData>(error);
    }
  }

  async reportComment(
    commentId: string,
    payload: ReportCommentDTO,
  ): Promise<ReportResponse> {
    try {
      const response = await this.request<{ message?: string }>(
        `/api/comments/${commentId}/report`,
        {
          method: 'POST',
          headers: { 'X-Client-Id': this.getClientId() },
          // body matches ReportCommentDTO: { reason, details? }
          // reason is one of: SPAM | FAKE_REVIEW | INAPPROPRIATE | WRONG_PRODUCT | QUALITY_ISSUE | OTHER
          body: JSON.stringify(payload),
        },
      );

      return createSuccessResponse(null, response.message ?? 'Comment reported successfully');
    } catch (error) {
      return this.handleError<null>(error);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const commentClient = new CommentClient();
export default CommentClient;