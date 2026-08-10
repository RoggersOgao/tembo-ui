import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';
import type { CommentEntityType, CommentStatus } from '@/components/schemas/comment-schema';

// ─── Comment interface (mirrors Prisma Comment model) ─────────────────────────

export interface Comment {
  id: string;
  body: string;                        // was: content
  entityType: CommentEntityType;       // 'PRODUCT' | 'ORDER' | 'REVIEW'
  productId: string | null;
  reviewId: string | null;
  userId: string;                      // was: authorId
  parentId: string | null;
  depth: number;
  status: CommentStatus;               // 'PUBLISHED' | 'PENDING_MODERATION' | 'FLAGGED' | 'HIDDEN' | 'DELETED'
  isDeleted: boolean;
  deletedAt: Date | null;
  isEdited: boolean;
  lastEditedAt: Date | null;
  editDeadline: Date | null;
  upvoteCount: number;
  downvoteCount: number;               // removed: voteScore (not in Prisma model)
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
  // Included relations
  user: {
    id: string;
    name: string | null;
    image: string | null;
    reputation: number;
  };
  userVote: 'UP' | 'DOWN' | null;
  replies?: Comment[];
  _count?: {
    replies: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateClientId = () =>
  `client-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth-token');
};

// ─── State interface ──────────────────────────────────────────────────────────

interface CommentState {
  // Data — keyed by productId
  comments: Record<string, Comment[]>;
  selectedComment: Comment | null;

  // UI
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  // Pagination — keyed by productId
  currentPage: Record<string, number>;
  hasMore: Record<string, boolean>;
  totalCount: Record<string, number>;

  // Sorting
  sortBy: 'newest' | 'oldest' | 'top' | 'controversial';

  // Socket
  socket: Socket | null;
  clientId: string | null;
  subscribedRooms: Set<string>;

  // Socket actions
  initSocket: () => Promise<Socket>;
  disconnectSocket: () => void;
  subscribeToProduct: (productId: string) => void;
  unsubscribeFromProduct: (productId: string) => void;

  // Data actions
  setComments: (productId: string, comments: Comment[]) => void;
  addComment: (productId: string, comment: Comment) => void;
  updateComment: (commentId: string, updates: Partial<Comment>) => void;
  removeComment: (commentId: string) => void;
  setSelectedComment: (comment: Comment | null) => void;

  // Vote actions
  voteComment: (commentId: string, voteType: 'UP' | 'DOWN' | null) => void;

  // UI actions
  setLoading: (loading: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  setError: (error: string | null) => void;
  setSortBy: (sortBy: 'newest' | 'oldest' | 'top' | 'controversial') => void;

  // Pagination actions
  setPage: (productId: string, page: number) => void;
  setHasMore: (productId: string, hasMore: boolean) => void;
  setTotalCount: (productId: string, count: number) => void;

  // Reset
  reset: () => void;
  resetProduct: (productId: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCommentStore = create<CommentState>()(
  devtools(
    (set, get) => ({
      // ── Initial state ───────────────────────────────────────────────────────
      comments: {},
      selectedComment: null,
      isLoading: false,
      isSubmitting: false,
      error: null,
      currentPage: {},
      hasMore: {},
      totalCount: {},
      sortBy: 'newest',
      socket: null,
      clientId: null,
      subscribedRooms: new Set(),

      // ── Socket ──────────────────────────────────────────────────────────────

      initSocket: async () => {
        const state = get();

        if (state.socket?.connected) return state.socket;

        if (state.socket) state.socket.disconnect();

        const clientId = generateClientId();
        const token = getAuthToken();
        const socketUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:5001';

        const socket = io(socketUrl, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
        });

        return new Promise((resolve, reject) => {
          socket.on('connect', () => {
            console.log('[Socket] Connected:', socket.id);
            set({ socket, clientId });

            // Resubscribe to all rooms after reconnection
            Array.from(state.subscribedRooms).forEach((room) => {
              socket.emit('subscribe', room);
            });

            resolve(socket);
          });

          // comment:update — matches CommentUpdateData from socket service
          socket.on('comment:update', (data: any) => {
            const { step, productId, comment, commentId, voteChange } = data;

            switch (step) {
              case 'comment_created':
                if (comment && productId) {
                  get().addComment(productId, transformCommentDates(comment));
                }
                break;

              case 'comment_updated':
                if (comment) {
                  get().updateComment(comment.id, transformCommentDates(comment));
                }
                break;

              case 'comment_deleted':
                if (commentId) {
                  get().updateComment(commentId, {
                    isDeleted: true,
                    body: '[deleted]',
                    deletedAt: new Date(),
                    status: 'DELETED',
                  });
                }
                break;

              case 'voted':
                if (commentId && voteChange) {
                  // voteChange: { upvoteCount, downvoteCount } — matches socket service
                  get().updateComment(commentId, voteChange);
                }
                break;
            }
          });

          // review:update — matches ReviewUpdatePayload from socket service
          socket.on('review:update', (data: any) => {
            console.log('[Socket] Review update received:', data);
          });

          socket.on('notification', (data: any) => {
            console.log('[Socket] Notification received:', data);
          });

          socket.on('connect_error', (error) => {
            console.error('[Socket] Connection error:', error);
            set({ error: 'Failed to connect to server' });
            reject(error);
          });

          socket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
          });

          socket.on('reconnect', (attemptNumber) => {
            console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
          });

          socket.on('reconnect_failed', () => {
            console.error('[Socket] Reconnection failed');
            set({ error: 'Connection to server lost' });
          });

          setTimeout(() => {
            if (!socket.connected) reject(new Error('Socket connection timeout'));
          }, 10000);
        });
      },

      subscribeToProduct: (productId) => {
        const { socket, subscribedRooms } = get();
        if (socket?.connected) {
          const room = `product:${productId}`;
          socket.emit('subscribe', room);
          subscribedRooms.add(room);
          set({ subscribedRooms: new Set(subscribedRooms) });
          console.log('[Socket] Subscribed to', room);
        }
      },

      unsubscribeFromProduct: (productId) => {
        const { socket, subscribedRooms } = get();
        if (socket?.connected) {
          const room = `product:${productId}`;
          socket.emit('unsubscribe', room);
          subscribedRooms.delete(room);
          set({ subscribedRooms: new Set(subscribedRooms) });
          console.log('[Socket] Unsubscribed from', room);
        }
      },

      disconnectSocket: () => {
        const { socket } = get();
        if (socket) {
          socket.disconnect();
          set({ socket: null, clientId: null, subscribedRooms: new Set() });
        }
      },

      // ── Data actions ────────────────────────────────────────────────────────

      setComments: (productId, comments) =>
        set((state) => ({
          comments: {
            ...state.comments,
            [productId]: transformCommentsRecursive(comments),
          },
        })),

      addComment: (productId, comment) =>
        set((state) => {
          const existing = state.comments[productId] ?? [];

          if (comment.parentId) {
            const updateReplies = (list: Comment[]): Comment[] =>
              list.map((c) => {
                if (c.id === comment.parentId) {
                  if (c.replies?.some((r) => r.id === comment.id)) return c;
                  return {
                    ...c,
                    replies: [...(c.replies ?? []), comment],
                    replyCount: c.replyCount + 1,
                    _count: { ...c._count, replies: (c._count?.replies ?? 0) + 1 },
                  };
                }
                if (c.replies?.length) return { ...c, replies: updateReplies(c.replies) };
                return c;
              });

            return {
              comments: {
                ...state.comments,
                [productId]: updateReplies(existing),
              },
            };
          }

          if (existing.some((c) => c.id === comment.id)) return state;

          return {
            comments: {
              ...state.comments,
              [productId]: [comment, ...existing],
            },
          };
        }),

      updateComment: (commentId, updates) =>
        set((state) => {
          const updateInList = (list: Comment[]): Comment[] =>
            list.map((c) => {
              if (c.id === commentId) return { ...c, ...updates };
              if (c.replies?.length) return { ...c, replies: updateInList(c.replies) };
              return c;
            });

          const updatedComments: Record<string, Comment[]> = {};
          for (const [prodId, list] of Object.entries(state.comments)) {
            updatedComments[prodId] = updateInList(list);
          }

          return { comments: updatedComments };
        }),

      removeComment: (commentId) =>
        set((state) => {
          const updateInList = (list: Comment[]): Comment[] =>
            list.map((c) => {
              if (c.id === commentId) {
                return {
                  ...c,
                  isDeleted: true,
                  body: '[deleted]',
                  deletedAt: new Date(),
                  status: 'DELETED' as CommentStatus,
                };
              }
              if (c.replies?.length) return { ...c, replies: updateInList(c.replies) };
              return c;
            });

          const updatedComments: Record<string, Comment[]> = {};
          for (const [prodId, list] of Object.entries(state.comments)) {
            updatedComments[prodId] = updateInList(list);
          }

          return { comments: updatedComments };
        }),

      setSelectedComment: (comment) => set({ selectedComment: comment }),

      // ── Vote (optimistic) ───────────────────────────────────────────────────

      voteComment: (commentId, voteType) =>
        set((state) => {
          const comment = findComment(state.comments, commentId);
          if (!comment) return state;

          let upvoteDelta = 0;
          let downvoteDelta = 0;

          // Undo previous vote
          if (comment.userVote === 'UP') upvoteDelta -= 1;
          else if (comment.userVote === 'DOWN') downvoteDelta -= 1;

          // Apply new vote (null = remove vote)
          if (voteType === 'UP') upvoteDelta += 1;
          else if (voteType === 'DOWN') downvoteDelta += 1;

          get().updateComment(commentId, {
            upvoteCount: comment.upvoteCount + upvoteDelta,
            downvoteCount: comment.downvoteCount + downvoteDelta,
            userVote: voteType,
          });

          return state;
        }),

      // ── UI actions ──────────────────────────────────────────────────────────

      setLoading: (loading) => set({ isLoading: loading }),
      setSubmitting: (submitting) => set({ isSubmitting: submitting }),
      setError: (error) => set({ error }),
      setSortBy: (sortBy) => set({ sortBy }),

      // ── Pagination ──────────────────────────────────────────────────────────

      setPage: (productId, page) =>
        set((state) => ({ currentPage: { ...state.currentPage, [productId]: page } })),

      setHasMore: (productId, hasMore) =>
        set((state) => ({ hasMore: { ...state.hasMore, [productId]: hasMore } })),

      setTotalCount: (productId, count) =>
        set((state) => ({ totalCount: { ...state.totalCount, [productId]: count } })),

      // ── Reset ───────────────────────────────────────────────────────────────

      reset: () => {
        get().socket?.disconnect();
        set({
          comments: {},
          selectedComment: null,
          isLoading: false,
          isSubmitting: false,
          error: null,
          currentPage: {},
          hasMore: {},
          totalCount: {},
          sortBy: 'newest',
          socket: null,
          clientId: null,
          subscribedRooms: new Set(),
        });
      },

      resetProduct: (productId) =>
        set((state) => {
          const comments    = { ...state.comments };    delete comments[productId];
          const currentPage = { ...state.currentPage }; delete currentPage[productId];
          const hasMore     = { ...state.hasMore };     delete hasMore[productId];
          const totalCount  = { ...state.totalCount };  delete totalCount[productId];
          return { comments, currentPage, hasMore, totalCount };
        }),
    }),
    { name: 'CommentStore' },
  ),
);

// ─── Module-level helpers ─────────────────────────────────────────────────────

function transformCommentDates(comment: any): Comment {
  return {
    ...comment,
    createdAt:    new Date(comment.createdAt),
    updatedAt:    new Date(comment.updatedAt),
    deletedAt:    comment.deletedAt    ? new Date(comment.deletedAt)    : null,
    lastEditedAt: comment.lastEditedAt ? new Date(comment.lastEditedAt) : null,
    editDeadline: comment.editDeadline ? new Date(comment.editDeadline) : null,
    replies: comment.replies ? transformCommentsRecursive(comment.replies) : undefined,
  };
}

function transformCommentsRecursive(comments: any[]): Comment[] {
  return comments.map(transformCommentDates);
}

function findComment(
  comments: Record<string, Comment[]>,
  commentId: string,
): Comment | null {
  for (const list of Object.values(comments)) {
    const found = findInList(list, commentId);
    if (found) return found;
  }
  return null;
}

function findInList(comments: Comment[], commentId: string): Comment | null {
  for (const comment of comments) {
    if (comment.id === commentId) return comment;
    if (comment.replies?.length) {
      const found = findInList(comment.replies, commentId);
      if (found) return found;
    }
  }
  return null;
}