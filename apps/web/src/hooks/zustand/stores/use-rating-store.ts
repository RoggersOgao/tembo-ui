import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';
import type { Review, ReviewSummary } from '@/lib/rating.api';

// Simple UUID generator for clientId
const generateClientId = () =>
  `client-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

// Helper to get auth token
const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth-token');
};

// ─── Helper: transform date strings → Date objects ────────────────────────────
function transformReviewDates(review: any): Review {
  return {
    ...review,
    createdAt:   new Date(review.createdAt),
    updatedAt:   new Date(review.updatedAt),
    moderatedAt: review.moderatedAt ? new Date(review.moderatedAt) : null,
  };
}

function transformReviewsArray(reviews: any[]): Review[] {
  return reviews.map(transformReviewDates);
}

// ─── State interface ──────────────────────────────────────────────────────────
interface ReviewState {
  // Data
  reviews:         Record<string, Review[]>;         // key: productId
  reviewSummaries: Record<string, ReviewSummary>;    // key: productId
  userReviews:     Record<string, Review | null>;    // key: productId

  // UI State
  isLoading:    boolean;
  isSubmitting: boolean;
  error:        string | null;

  // Pagination
  currentPage: Record<string, number>;
  hasMore:     Record<string, boolean>;
  totalCount:  Record<string, number>;

  // Filters — aligned with ReviewQuerySchema
  filterRating: number | null;
  sortBy: 'newest' | 'oldest' | 'highest' | 'lowest' | 'most_helpful';

  // Socket Management
  socket:          Socket | null;
  clientId:        string | null;
  subscribedRooms: Set<string>;

  // Socket Actions
  initSocket:            () => Promise<Socket>;
  disconnectSocket:      () => void;
  subscribeToProduct:    (productId: string) => void;
  unsubscribeFromProduct:(productId: string) => void;

  // Review CRUD actions
  setReviews:   (productId: string, reviews: Review[]) => void;
  addReview:    (productId: string, review: Review) => void;
  updateReview: (reviewId: string, updates: Partial<Review>) => void;
  removeReview: (reviewId: string) => void;

  // Summary / user review
  setSummary:    (productId: string, summary: ReviewSummary) => void;
  setUserReview: (productId: string, review: Review | null) => void;

  // UI Actions
  setLoading:      (loading: boolean)    => void;
  setSubmitting:   (submitting: boolean) => void;
  setError:        (error: string | null) => void;
  setFilterRating: (rating: number | null) => void;
  setSortBy:       (sortBy: ReviewState['sortBy']) => void;

  // Pagination
  setPage:       (productId: string, page: number)    => void;
  setHasMore:    (productId: string, hasMore: boolean) => void;
  setTotalCount: (productId: string, count: number)   => void;

  // Reset
  reset:         () => void;
  resetProduct:  (productId: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useReviewStore = create<ReviewState>()(
  devtools(
    (set, get) => ({
      // ── Initial State ──────────────────────────────────────────────────────
      reviews:         {},
      reviewSummaries: {},
      userReviews:     {},
      isLoading:       false,
      isSubmitting:    false,
      error:           null,
      currentPage:     {},
      hasMore:         {},
      totalCount:      {},
      filterRating:    null,
      sortBy:          'newest',
      socket:          null,
      clientId:        null,
      subscribedRooms: new Set(),

      // ── Socket Init ────────────────────────────────────────────────────────
      initSocket: async () => {
        const state = get();

        if (state.socket?.connected) return state.socket;
        if (state.socket) state.socket.disconnect();

        const clientId  = generateClientId();
        const token     = getAuthToken();
        const socketUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5001';

        const socket = io(socketUrl, {
          auth:                { token },
          transports:          ['websocket', 'polling'],
          reconnection:        true,
          reconnectionDelay:   1000,
          reconnectionAttempts: 5,
        });

        return new Promise((resolve, reject) => {
          socket.on('connect', () => {
            console.log('[ReviewSocket] Connected:', socket.id);
            set({ socket, clientId });

            // Resubscribe to all rooms after reconnect
            Array.from(state.subscribedRooms).forEach(room => {
              socket.emit('subscribe', room);
            });

            resolve(socket);
          });

          // ── review:update — emitted by broadcastReviewUpdate() ────────────
          socket.on('review:update', (data: any) => {
            console.log('[ReviewSocket] review:update received:', data);

            const { action, productId, review, reviewId, summary } = data;

            switch (action) {
              case 'created':
                if (review && productId) {
                  get().addReview(productId, transformReviewDates(review));
                }
                if (summary && productId) {
                  get().setSummary(productId, summary);
                }
                break;

              case 'updated':
              case 'moderated':
                if (review) {
                  get().updateReview(review.id, transformReviewDates(review));
                }
                if (summary && productId) {
                  get().setSummary(productId, summary);
                }
                break;

              case 'deleted':
                if (reviewId) {
                  get().removeReview(reviewId);
                }
                if (summary && productId) {
                  get().setSummary(productId, summary);
                }
                break;
            }
          });

          socket.on('comment:update', (data: any) => {
            console.log('[ReviewSocket] comment:update received:', data);
          });

          socket.on('notification', (data: any) => {
            console.log('[ReviewSocket] notification received:', data);
          });

          socket.on('connect_error', (error) => {
            console.error('[ReviewSocket] Connection error:', error);
            set({ error: 'Failed to connect to server' });
            reject(error);
          });

          socket.on('disconnect', (reason) => {
            console.log('[ReviewSocket] Disconnected:', reason);
          });

          socket.on('reconnect', (attemptNumber) => {
            console.log('[ReviewSocket] Reconnected after', attemptNumber, 'attempts');
          });

          socket.on('reconnect_error', (error) => {
            console.error('[ReviewSocket] Reconnection error:', error);
          });

          socket.on('reconnect_failed', () => {
            console.error('[ReviewSocket] Reconnection failed');
            set({ error: 'Connection to server lost' });
          });

          setTimeout(() => {
            if (!socket.connected) reject(new Error('Socket connection timeout'));
          }, 10_000);
        });
      },

      // ── Subscribe / Unsubscribe ────────────────────────────────────────────
      subscribeToProduct: (productId) => {
        const { socket, subscribedRooms } = get();
        if (socket?.connected) {
          const room = `product:${productId}`;   // matches server room naming
          socket.emit('subscribe', room);
          subscribedRooms.add(room);
          set({ subscribedRooms: new Set(subscribedRooms) });
          console.log('[ReviewSocket] Subscribed to', room);
        }
      },

      unsubscribeFromProduct: (productId) => {
        const { socket, subscribedRooms } = get();
        if (socket?.connected) {
          const room = `product:${productId}`;
          socket.emit('unsubscribe', room);
          subscribedRooms.delete(room);
          set({ subscribedRooms: new Set(subscribedRooms) });
          console.log('[ReviewSocket] Unsubscribed from', room);
        }
      },

      disconnectSocket: () => {
        const { socket } = get();
        if (socket) {
          socket.disconnect();
          set({ socket: null, clientId: null, subscribedRooms: new Set() });
        }
      },

      // ── Review CRUD ────────────────────────────────────────────────────────
      setReviews: (productId, reviews) =>
        set((state) => ({
          reviews: {
            ...state.reviews,
            [productId]: transformReviewsArray(reviews),
          },
        })),

      addReview: (productId, review) =>
        set((state) => {
          const existing = state.reviews[productId] ?? [];

          // Prevent duplicates
          if (existing.some((r) => r.id === review.id)) return state;

          // Replace if same user already has a review (one per user per product)
          const filtered = existing.filter((r) => r.userId !== review.userId);

          return {
            reviews: {
              ...state.reviews,
              [productId]: [review, ...filtered],
            },
          };
        }),

      updateReview: (reviewId, updates) =>
        set((state) => {
          const updatedReviews: Record<string, Review[]> = {};
          Object.entries(state.reviews).forEach(([productId, reviews]) => {
            updatedReviews[productId] = reviews.map((r) =>
              r.id === reviewId ? { ...r, ...updates } : r,
            );
          });
          return { reviews: updatedReviews };
        }),

      removeReview: (reviewId) =>
        set((state) => {
          const updatedReviews: Record<string, Review[]> = {};
          Object.entries(state.reviews).forEach(([productId, reviews]) => {
            updatedReviews[productId] = reviews.filter((r) => r.id !== reviewId);
          });
          return { reviews: updatedReviews };
        }),

      // ── Summary / User Review ──────────────────────────────────────────────
      setSummary: (productId, summary) =>
        set((state) => ({
          reviewSummaries: {
            ...state.reviewSummaries,
            [productId]: summary,
          },
        })),

      setUserReview: (productId, review) =>
        set((state) => ({
          userReviews: {
            ...state.userReviews,
            [productId]: review ? transformReviewDates(review) : null,
          },
        })),

      // ── UI ─────────────────────────────────────────────────────────────────
      setLoading:      (loading)    => set({ isLoading: loading }),
      setSubmitting:   (submitting) => set({ isSubmitting: submitting }),
      setError:        (error)      => set({ error }),
      setFilterRating: (rating)     => set({ filterRating: rating }),
      setSortBy:       (sortBy)     => set({ sortBy }),

      // ── Pagination ─────────────────────────────────────────────────────────
      setPage: (productId, page) =>
        set((state) => ({ currentPage: { ...state.currentPage, [productId]: page } })),

      setHasMore: (productId, hasMore) =>
        set((state) => ({ hasMore: { ...state.hasMore, [productId]: hasMore } })),

      setTotalCount: (productId, count) =>
        set((state) => ({ totalCount: { ...state.totalCount, [productId]: count } })),

      // ── Reset ──────────────────────────────────────────────────────────────
      reset: () => {
        const { socket } = get();
        if (socket) socket.disconnect();
        set({
          reviews:         {},
          reviewSummaries: {},
          userReviews:     {},
          isLoading:       false,
          isSubmitting:    false,
          error:           null,
          currentPage:     {},
          hasMore:         {},
          totalCount:      {},
          filterRating:    null,
          sortBy:          'newest',
          socket:          null,
          clientId:        null,
          subscribedRooms: new Set(),
        });
      },

      resetProduct: (productId) =>
        set((state) => {
          const reviews         = { ...state.reviews };
          const reviewSummaries = { ...state.reviewSummaries };
          const userReviews     = { ...state.userReviews };
          const currentPage     = { ...state.currentPage };
          const hasMore         = { ...state.hasMore };
          const totalCount      = { ...state.totalCount };

          delete reviews[productId];
          delete reviewSummaries[productId];
          delete userReviews[productId];
          delete currentPage[productId];
          delete hasMore[productId];
          delete totalCount[productId];

          return { reviews, reviewSummaries, userReviews, currentPage, hasMore, totalCount };
        }),
    }),
    { name: 'ReviewStore' },
  ),
);