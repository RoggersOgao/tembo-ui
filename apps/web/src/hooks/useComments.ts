import { useCallback, useEffect } from 'react';
import {
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { useCommentStore } from './zustand/stores/use-comment-store';
import { commentClient } from '@/lib/comment.api';
import type {
  CreateCommentDTO,
  UpdateCommentDTO,
  VoteCommentDTO,
  ReportCommentDTO,
} from '@/components/schemas/comment-schema';

// ── Query key factory ─────────────────────────────────────────────────────────

export const commentKeys = {
  all: ['comments'] as const,
  product: (productId: string, sortBy?: string) =>
    [...commentKeys.all, productId, sortBy] as const,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 8;

function isValidId(id: string | undefined | null): id is string {
  return !!id && id !== 'undefined' && id !== 'null';
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useComments(productId: string) {
  const queryClient = useQueryClient();

  const {
    sortBy,
    initSocket,
    subscribeToProduct,
    unsubscribeFromProduct,
    voteComment,
  } = useCommentStore();

  // ─── Socket setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isValidId(productId)) return;

    let mounted = true;

    const setupSocket = async () => {
      try {
        await initSocket();
        if (mounted) subscribeToProduct(productId);
      } catch (error) {
        console.error('[Socket] Failed to initialize:', error);
      }
    };

    setupSocket();

    return () => {
      mounted = false;
      unsubscribeFromProduct(productId);
    };
  }, [productId, initSocket, subscribeToProduct, unsubscribeFromProduct]);

  // ─── Fetch comments (infinite / paginated) ────────────────────────────────
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: commentKeys.product(productId, sortBy),
    queryFn: ({ pageParam = 1 }) =>
      commentClient.fetchComments(productId, {
        page: pageParam as number,
        limit: PAGE_LIMIT,
        sortBy,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const hasMore = lastPage?.data?.hasMore;
      return hasMore ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: isValidId(productId),
    select: (data) => ({
      comments: data.pages.flatMap((p) => p?.data?.comments ?? []),
      totalCount: data.pages[0]?.data?.totalCount ?? 0,
      hasMore: data.pages[data.pages.length - 1]?.data?.hasMore ?? false,
    }),
  });

  const comments = data?.comments ?? [];
  const hasMore = data?.hasMore ?? false;

  const fetchComments = useCallback(
    async (pageNum: number = 1) => {
      if (!isValidId(productId)) {
        console.warn('[useComments] Invalid productId:', productId);
        return;
      }
      if (pageNum === 1) {
        await refetch();
      } else {
        await fetchNextPage();
      }
    },
    [productId, refetch, fetchNextPage],
  );

  // ─── Create comment ───────────────────────────────────────────────────────
  const createCommentMutation = useMutation({
    mutationFn: (payload: CreateCommentDTO) => {
      if (!isValidId(productId)) throw new Error('Invalid product ID');
      if (!payload.body?.trim()) throw new Error('Comment body cannot be empty');
      return commentClient.createComment(productId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.product(productId, sortBy),
      });
    },
    onError: (err: Error) => {
      console.error('[useComments] Error creating comment:', err.message);
    },
  });

  const createComment = useCallback(
    async (payload: CreateCommentDTO) => {
      const result = await createCommentMutation.mutateAsync(payload);
      return result?.data;
    },
    [createCommentMutation],
  );

  // ─── Edit comment ─────────────────────────────────────────────────────────
  const editCommentMutation = useMutation({
    mutationFn: ({
      commentId,
      payload,
    }: {
      commentId: string;
      payload: UpdateCommentDTO;
    }) => {
      if (!isValidId(commentId)) throw new Error('Invalid comment ID');
      if (!payload.body?.trim()) throw new Error('Comment body cannot be empty');
      return commentClient.updateComment(commentId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.product(productId, sortBy),
      });
    },
    onError: (err: Error) => {
      console.error('[useComments] Error updating comment:', err.message);
    },
  });

  const editComment = useCallback(
    async (commentId: string, payload: UpdateCommentDTO) => {
      await editCommentMutation.mutateAsync({ commentId, payload });
    },
    [editCommentMutation],
  );

  // ─── Delete comment ───────────────────────────────────────────────────────
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => {
      if (!isValidId(commentId)) throw new Error('Invalid comment ID');
      return commentClient.deleteComment(commentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.product(productId, sortBy),
      });
    },
    onError: (err: Error) => {
      console.error('[useComments] Error deleting comment:', err.message);
    },
  });

  const deleteComment = useCallback(
    async (commentId: string) => {
      await deleteCommentMutation.mutateAsync(commentId);
    },
    [deleteCommentMutation],
  );

  // ─── Vote ─────────────────────────────────────────────────────────────────
  // VoteType is 'UP' | 'DOWN' only (no REMOVE — send a DELETE request instead)
  const voteMutation = useMutation({
    mutationFn: ({
      commentId,
      payload,
    }: {
      commentId: string;
      payload: VoteCommentDTO;
    }) => {
      if (!isValidId(commentId)) throw new Error('Invalid comment ID');
      return commentClient.voteComment(commentId, payload);
    },
    onMutate: ({ commentId, payload }) => {
      // Optimistic update via Zustand store
      voteComment(commentId, payload.voteType);
    },
    onError: (err: Error) => {
      console.error('[useComments] Error voting on comment:', err.message);
      // Revert by refetching
      queryClient.invalidateQueries({
        queryKey: commentKeys.product(productId, sortBy),
      });
    },
  });

  const vote = useCallback(
    async (commentId: string, payload: VoteCommentDTO) => {
      await voteMutation.mutateAsync({ commentId, payload });
    },
    [voteMutation],
  );

  // Separate mutation for removing a vote (DELETE endpoint)
  const removeVoteMutation = useMutation({
    mutationFn: (commentId: string) => {
      if (!isValidId(commentId)) throw new Error('Invalid comment ID');
      return commentClient.removeVote(commentId);
    },
    onMutate: (commentId) => {
      voteComment(commentId, null);
    },
    onError: (err: Error) => {
      console.error('[useComments] Error removing vote:', err.message);
      queryClient.invalidateQueries({
        queryKey: commentKeys.product(productId, sortBy),
      });
    },
  });

  const removeVote = useCallback(
    async (commentId: string) => {
      await removeVoteMutation.mutateAsync(commentId);
    },
    [removeVoteMutation],
  );

  // ─── Report comment ───────────────────────────────────────────────────────
  // reason must be one of: SPAM | FAKE_REVIEW | INAPPROPRIATE | WRONG_PRODUCT | QUALITY_ISSUE | OTHER
  const reportMutation = useMutation({
    mutationFn: ({
      commentId,
      payload,
    }: {
      commentId: string;
      payload: ReportCommentDTO;
    }) => {
      if (!isValidId(commentId)) throw new Error('Invalid comment ID');
      return commentClient.reportComment(commentId, payload);
    },
    onError: (err: Error) => {
      console.error('[useComments] Error reporting comment:', err.message);
    },
  });

  const report = useCallback(
    async (commentId: string, payload: ReportCommentDTO) => {
      return reportMutation.mutateAsync({ commentId, payload });
    },
    [reportMutation],
  );

  // ─── Derived state ────────────────────────────────────────────────────────
  const isSubmitting =
    createCommentMutation.isPending ||
    editCommentMutation.isPending ||
    deleteCommentMutation.isPending ||
    voteMutation.isPending ||
    removeVoteMutation.isPending ||
    reportMutation.isPending;

  const errorMessage =
    (error as Error | null)?.message ??
    createCommentMutation.error?.message ??
    editCommentMutation.error?.message ??
    deleteCommentMutation.error?.message ??
    voteMutation.error?.message ??
    removeVoteMutation.error?.message ??
    reportMutation.error?.message ??
    null;

  return {
    comments,
    isLoading,
    isSubmitting,
    isFetchingNextPage,
    hasNextPage,
    error: errorMessage,
    hasMore,
    fetchComments,
    createComment,
    editComment,
    deleteComment,
    vote,
    removeVote,
    report,
  };
}