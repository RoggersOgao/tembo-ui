// lib/review.api.ts

import { ApiResponse, createSuccessResponse } from '@repo/api-utils';
import { getToken } from './get-token';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  orderId?: string | null;
  rating: number;
  title?: string | null;
  body?: string | null;
  images: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED' | 'REMOVED';
  isVerified: boolean;
  isFeatured: boolean;
  helpfulCount: number;
  notHelpfulCount: number;
  moderatedBy?: string | null;
  moderatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: ReviewUser;
}

export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface ReviewsListData {
  reviews: Review[];
  hasMore: boolean;
  totalCount: number;
  page: number;
}

export interface FetchReviewsParams {
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'highest' | 'lowest' | 'most_helpful';
  rating?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED' | 'REMOVED';
  isVerified?: boolean;
  isFeatured?: boolean;
}

export interface CreateReviewPayload {
  rating: number;
  title?: string;
  body?: string;
  images?: string[];
  orderId?: string;
}

export interface UpdateReviewPayload {
  rating?: number;
  title?: string;
  body?: string;
  images?: string[];
}

export interface VoteResult {
  helpfulCount: number;
  notHelpfulCount: number;
}

export type ReviewsResponse     = ApiResponse<ReviewsListData>;
export type ReviewResponse      = ApiResponse<Review>;
export type ReviewSummaryResponse = ApiResponse<ReviewSummary>;
export type VoteResponse        = ApiResponse<VoteResult>;

// ─── Client ───────────────────────────────────────────────────────────────────

class ReviewClient {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
  }

  private transformReview(review: any): Review {
    return {
      ...review,
      createdAt:   new Date(review.createdAt),
      updatedAt:   new Date(review.updatedAt),
      moderatedAt: review.moderatedAt ? new Date(review.moderatedAt) : null,
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
      if (!token) throw new Error('Authorization token is missing. Please log in.');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const res = await fetch(`${this.baseURL}${endpoint}`, { ...options, headers });

    if (res.status === 401) throw new Error('Unauthorized. Please log in.');

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

  // ── GET /api/reviews/products/:productId/reviews ─────────────────────────
  async fetchReviews(
    productId: string,
    params: FetchReviewsParams = {},
  ): Promise<ReviewsResponse> {
    const { page = 1, limit = 10, sortBy = 'newest', rating, status, isVerified, isFeatured } = params;

    const qs = new URLSearchParams({
      page:  String(page),
      limit: String(limit),
      sortBy,
    });
    if (rating    !== undefined) qs.set('rating',    String(rating));
    if (status    !== undefined) qs.set('status',    status);
    if (isVerified !== undefined) qs.set('isVerified', String(isVerified));
    if (isFeatured !== undefined) qs.set('isFeatured', String(isFeatured));

    const response = await this.request<{ data: ReviewsListData; message?: string }>(
      `/api/reviews/products/${productId}/reviews?${qs}`,
      {},
      false,
    );

    return createSuccessResponse(
      {
        ...response.data,
        reviews: response.data.reviews.map(r => this.transformReview(r)),
      },
      response.message ?? 'Reviews retrieved successfully',
    );
  }

  // ── GET /api/reviews/products/:productId/summary ─────────────────────────
  async fetchReviewSummary(productId: string): Promise<ReviewSummaryResponse> {
    const response = await this.request<{ data: ReviewSummary; message?: string }>(
      `/api/reviews/products/${productId}/review-summary`,
      {},
      false,
    );

    return createSuccessResponse(
      response.data,
      response.message ?? 'Review summary retrieved successfully',
    );
  }

  // ── GET /api/reviews/products/:productId/my-review ───────────────────────
  async fetchUserReview(productId: string): Promise<ApiResponse<Review | null>> {
    try {
      const response = await this.request<{ data: Review; message?: string }>(
        `/api/reviews/products/${productId}/my-reviews`,
      );

      return createSuccessResponse(
        this.transformReview(response.data),
        response.message ?? 'User review retrieved successfully',
      );
    } catch (error) {
      // 404 is expected when user hasn't reviewed yet — normalise to null
      if (
        error instanceof Error &&
        (error.message.includes('404') || error.message.toLowerCase().includes('not found'))
      ) {
        return createSuccessResponse<Review | null>(null, 'No review found for this product');
      }
      throw error;
    }
  }

  // ── GET /api/reviews/:id ─────────────────────────────────────────────────
  async fetchReviewById(reviewId: string): Promise<ReviewResponse> {
    const response = await this.request<{ data: Review; message?: string }>(
      `/api/reviews/${reviewId}`,
      {},
      false,
    );

    return createSuccessResponse(
      this.transformReview(response.data),
      response.message ?? 'Review retrieved successfully',
    );
  }

  // ── POST /api/reviews/products/:productId/reviews ────────────────────────
  async submitReview(productId: string, payload: CreateReviewPayload): Promise<ReviewResponse> {
    const response = await this.request<{ data: Review; message?: string }>(
      `/api/reviews/products/${productId}/reviews`,
      {
        method:  'POST',
        headers: { 'X-Client-Id': this.getClientId() },
        body:    JSON.stringify(payload),
      },
    );

    return createSuccessResponse(
      this.transformReview(response.data),
      response.message ?? 'Review submitted successfully',
    );
  }

  // ── PUT /api/reviews/:id ─────────────────────────────────────────────────
  async updateReview(reviewId: string, payload: UpdateReviewPayload): Promise<ReviewResponse> {
    const response = await this.request<{ data: Review; message?: string }>(
      `/api/reviews/${reviewId}`,
      {
        method:  'PUT',
        headers: { 'X-Client-Id': this.getClientId() },
        body:    JSON.stringify(payload),
      },
    );

    return createSuccessResponse(
      this.transformReview(response.data),
      response.message ?? 'Review updated successfully',
    );
  }

  // ── DELETE /api/reviews/:id ──────────────────────────────────────────────
  async deleteReview(reviewId: string): Promise<ApiResponse<null>> {
    await this.request<void>(
      `/api/reviews/${reviewId}`,
      {
        method:  'DELETE',
        headers: { 'X-Client-Id': this.getClientId() },
      },
    );

    return createSuccessResponse(null, 'Review deleted successfully');
  }

  // ── POST /api/reviews/:id/vote ───────────────────────────────────────────
  async voteReview(reviewId: string, helpful: boolean): Promise<VoteResponse> {
    const response = await this.request<{ data: VoteResult; message?: string }>(
      `/api/reviews/${reviewId}/vote`,
      {
        method: 'POST',
        body:   JSON.stringify({ helpful }),
      },
    );

    return createSuccessResponse(
      response.data,
      response.message ?? 'Vote recorded successfully',
    );
  }

  // ── DELETE /api/reviews/:id/vote ─────────────────────────────────────────
  async removeVote(reviewId: string): Promise<ApiResponse<null>> {
    await this.request<void>(`/api/reviews/${reviewId}/vote`, { method: 'DELETE' });

    return createSuccessResponse(null, 'Vote removed successfully');
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const reviewClient = new ReviewClient();
export default ReviewClient;