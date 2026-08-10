// hooks/useReviews.ts
import { useCallback, useEffect } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import {
  reviewClient,
  Review,
  ReviewSummary,
  ReviewsListData,
  FetchReviewsParams,
  CreateReviewPayload,
  UpdateReviewPayload,
} from '@/lib/rating.api';
import { useReviewStore } from './zustand/stores/use-rating-store';

// ─── Query Key Factory ────────────────────────────────────────────────────────
export const reviewKeys = {
  all: (productId: string) => ['reviews', productId] as const,
  list: (productId: string, page: number, sortBy?: string, rating?: number) =>
    ['reviews', productId, 'list', { page, sortBy, rating }] as const,
  summary: (productId: string) => ['reviews', productId, 'summary'] as const,
  mine: (productId: string) => ['reviews', productId, 'mine'] as const,
  byId: (reviewId: string) => ['reviews', 'detail', reviewId] as const,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useReviews(
  productId: string,
  page = 1,
  sortBy?: FetchReviewsParams['sortBy'],
  filterRating?: number,
) {
  const queryClient = useQueryClient();

  const { initSocket, subscribeToProduct, unsubscribeFromProduct } = useReviewStore();

  const isValidId = Boolean(
    productId && productId !== 'undefined' && productId !== 'null',
  );

  // ── Connect socket and subscribe to real-time updates ───────────────────
  useEffect(() => {
    if (!isValidId) return;

    let mounted = true;

    const connect = async () => {
      try {
        await initSocket();
        if (mounted) subscribeToProduct(productId);
      } catch (err) {
        console.warn('[useReviews] Socket connection failed, falling back to polling:', err);
      }
    };

    connect();

    return () => {
      mounted = false;
      unsubscribeFromProduct(productId);
    };
  }, [productId, isValidId, initSocket, subscribeToProduct, unsubscribeFromProduct]);

  // ── Wire socket events → TanStack Query cache invalidation ──────────────
  useEffect(() => {
    if (!isValidId) return;

    const store = useReviewStore.getState();
    const socket = store.socket;
    if (!socket) return;

    const handleReviewUpdate = () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all(productId) });
    };

    socket.on('review:update', handleReviewUpdate);

    return () => {
      socket.off('review:update', handleReviewUpdate);
    };
  }, [productId, isValidId, queryClient]);

  // ── Reviews list ─────────────────────────────────────────────────────────
  const reviewsQuery = useQuery({
    queryKey: reviewKeys.list(productId, page, sortBy, filterRating),
    queryFn: async (): Promise<Pick<ReviewsListData, 'reviews' | 'hasMore' | 'totalCount'>> => {
      const result = await reviewClient.fetchReviews(productId, {
        page,
        limit: 10,
        sortBy,
        rating: filterRating,
      });
      if (!result.success || !result.data) {
        throw new Error(result.message ?? 'Failed to fetch reviews');
      }
      return {
        reviews: result.data.reviews,
        hasMore: result.data.hasMore,
        totalCount: result.data.totalCount,
      };
    },
    enabled: isValidId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // ── Summary ──────────────────────────────────────────────────────────────
  const summaryQuery = useQuery({
    queryKey: reviewKeys.summary(productId),
    queryFn: async (): Promise<ReviewSummary> => {
      const result = await reviewClient.fetchReviewSummary(productId);
      if (!result.success || !result.data) {
        throw new Error(result.message ?? 'Failed to fetch summary');
      }
      return result.data;
    },
    enabled: isValidId,
    staleTime: 30_000,
  });

  // ── User's own review ────────────────────────────────────────────────────
  const userReviewQuery = useQuery({
    queryKey: reviewKeys.mine(productId),
    queryFn: async (): Promise<Review | null> => {
      const result = await reviewClient.fetchUserReview(productId);
      if (!result.success) {
        throw new Error(result.message ?? 'Failed to fetch user review');
      }
      return result.data ?? null;
    },
    enabled: isValidId,
    staleTime: 30_000,
  });

  // ── Invalidate all review caches for this product ────────────────────────
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: reviewKeys.all(productId) });
  }, [queryClient, productId]);

  // ── Submit (create) ──────────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async (payload: CreateReviewPayload) => {
      const result = await reviewClient.submitReview(productId, payload);
      if (!result.success || !result.data) {
        throw new Error(result.message ?? 'Failed to submit review');
      }
      return result.data;
    },
    onSuccess: (review) => {
      queryClient.setQueryData(reviewKeys.mine(productId), review);
      useReviewStore.getState().setUserReview(productId, review);
      invalidateAll();
    },
    onError: (error) => {
      console.error('[useReviews] Failed to submit review:', error);
    },
  });

  // ── Edit (update) ────────────────────────────────────────────────────────
  const editMutation = useMutation({
    mutationFn: async ({
      reviewId,
      payload,
    }: {
      reviewId: string;
      payload: UpdateReviewPayload;
    }) => {
      const result = await reviewClient.updateReview(reviewId, payload);
      if (!result.success || !result.data) {
        throw new Error(result.message ?? 'Failed to update review');
      }
      return result.data;
    },
    onSuccess: (review) => {
      queryClient.setQueryData(reviewKeys.mine(productId), review);
      queryClient.setQueryData(reviewKeys.byId(review.id), review);
      useReviewStore.getState().setUserReview(productId, review);
      invalidateAll();
    },
    onError: (error) => {
      console.error('[useReviews] Failed to update review:', error);
    },
  });

  // ── Delete ───────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const result = await reviewClient.deleteReview(reviewId);
      if (!result.success) {
        throw new Error(result.message ?? 'Failed to delete review');
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(reviewKeys.mine(productId), null);
      useReviewStore.getState().setUserReview(productId, null);
      invalidateAll();
    },
    onError: (error) => {
      console.error('[useReviews] Failed to delete review:', error);
    },
  });

  // ── Vote ─────────────────────────────────────────────────────────────────
  const voteMutation = useMutation({
    mutationFn: async ({ reviewId, helpful }: { reviewId: string; helpful: boolean }) => {
      const result = await reviewClient.voteReview(reviewId, helpful);
      if (!result.success || !result.data) {
        throw new Error(result.message ?? 'Failed to record vote');
      }
      return result.data;
    },
    onSuccess: () => {
      invalidateAll();
    },
    onError: (error) => {
      console.error('[useReviews] Failed to vote on review:', error);
    },
  });

  // ── Remove Vote ──────────────────────────────────────────────────────────
  const removeVoteMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const result = await reviewClient.removeVote(reviewId);
      if (!result.success) {
        throw new Error(result.message ?? 'Failed to remove vote');
      }
    },
    onSuccess: () => {
      invalidateAll();
    },
    onError: (error) => {
      console.error('[useReviews] Failed to remove vote:', error);
    },
  });

  // ── Public API ───────────────────────────────────────────────────────────
  const submitReview = useCallback(
    async (payload: CreateReviewPayload) => {
      if (payload.rating < 1 || payload.rating > 5) {
        throw new Error('Rating must be between 1 and 5 stars');
      }
      return submitMutation.mutateAsync(payload);
    },
    [submitMutation],
  );

  const editReview = useCallback(
    async (reviewId: string, payload: UpdateReviewPayload) => {
      if (payload.rating !== undefined && (payload.rating < 1 || payload.rating > 5)) {
        throw new Error('Rating must be between 1 and 5 stars');
      }
      return editMutation.mutateAsync({ reviewId, payload });
    },
    [editMutation],
  );

  const deleteReview = useCallback(
    async (reviewId: string) => deleteMutation.mutateAsync(reviewId),
    [deleteMutation],
  );

  const voteReview = useCallback(
    async (reviewId: string, helpful: boolean) => voteMutation.mutateAsync({ reviewId, helpful }),
    [voteMutation],
  );

  const removeVote = useCallback(
    async (reviewId: string) => removeVoteMutation.mutateAsync(reviewId),
    [removeVoteMutation],
  );

  const isSubmitting =
    submitMutation.isPending ||
    editMutation.isPending ||
    deleteMutation.isPending ||
    voteMutation.isPending ||
    removeVoteMutation.isPending;

  const error =
    reviewsQuery.error?.message ??
    summaryQuery.error?.message ??
    userReviewQuery.error?.message ??
    submitMutation.error?.message ??
    editMutation.error?.message ??
    deleteMutation.error?.message ??
    voteMutation.error?.message ??
    removeVoteMutation.error?.message ??
    null;

  return {
    // Data
    reviews: reviewsQuery.data?.reviews ?? [],
    summary: summaryQuery.data ?? null,
    userReview: userReviewQuery.data ?? null,
    hasMore: reviewsQuery.data?.hasMore ?? false,
    totalCount: reviewsQuery.data?.totalCount ?? 0,
    page,

    // Loading states
    isLoading: reviewsQuery.isLoading || summaryQuery.isLoading,
    isSubmitting,
    error,

    // Actions
    submitReview,
    editReview,
    deleteReview,
    voteReview,
    removeVote,

    // Manual refetch
    fetchReviews: reviewsQuery.refetch,
  };
}