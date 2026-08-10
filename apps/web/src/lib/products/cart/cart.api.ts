// lib/cart.api.ts
import {
  ApiResponse,
  ErrorCode,
  createSuccessResponse,
  createErrorResponse,
} from '@repo/api-utils';


import type {
  Cart,
  CartItem,
  CartCoupon,
  CartData,
  CartItemData,
  CouponData,
  CartResponse,
  CartItemResponse,
  CouponResponse,
  ClearCartResponse,
  AddToCartDTO,
  UpdateCartItemDTO,
  ApplyCouponDTO,
} from '@/types/products/cart/cart.types';
import { getToken } from '@/lib/get-token';

// ─── Re-exports for convenience ───────────────────────────────────────────────

export type {
  Cart,
  CartItem,
  CartCoupon,
  CartData,
  CartItemData,
  CouponData,
  CartResponse,
  CartItemResponse,
  CouponResponse,
  ClearCartResponse,
  AddToCartDTO,
  UpdateCartItemDTO,
  ApplyCouponDTO,
};

// ─── Client ───────────────────────────────────────────────────────────────────

class CartClient {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private transformDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    return new Date(value);
  }

  private transformCoupon(coupon: any): CartCoupon {
    return {
      ...coupon,
      expiresAt: this.transformDate(coupon.expiresAt),
    };
  }

  private transformCartItem(item: any): CartItem {
    return {
      ...item,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
      lineTotal: item.quantity * item.unitPrice,
      variant: item.variant ?? null,
    };
  }

  private transformCart(cart: any): Cart {
    return {
      ...cart,
      createdAt: new Date(cart.createdAt),
      updatedAt: new Date(cart.updatedAt),
      expiresAt: this.transformDate(cart.expiresAt),
      coupon: cart.coupon ? this.transformCoupon(cart.coupon) : null,
      items: (cart.items ?? []).map((i: any) => this.transformCartItem(i)),
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

  /** GET /cart — fetch the authenticated user's cart */
  async getCart(): Promise<CartResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        '/api/cart',
      );

      return createSuccessResponse(
        { cart: this.transformCart(response.data) },
        response.message ?? 'Cart retrieved successfully',
      );
    } catch (error) {
      return this.handleError<CartData>(error);
    }
  }

  /** POST /cart/items — add a product (+ optional variant) to the cart */
  async addToCart(payload: AddToCartDTO): Promise<CartItemResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        '/api/cart/items',
        {
          method: 'POST',
          // body matches AddToCartDTO: { productId, variantId?, quantity, notes? }
          body: JSON.stringify(payload),
        },
      );

      return createSuccessResponse(
        { item: this.transformCartItem(response.data) },
        response.message ?? 'Item added to cart',
      );
    } catch (error) {
      return this.handleError<CartItemData>(error);
    }
  }

  /** PUT /cart/items/:itemId — update quantity or notes on an existing item */
  async updateCartItem(
    itemId: string,
    payload: UpdateCartItemDTO,
  ): Promise<CartItemResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/cart/items/${itemId}`,
        {
          method: 'PUT',
          // body matches UpdateCartItemDTO: { quantity?, notes? }
          body: JSON.stringify(payload),
        },
      );

      return createSuccessResponse(
        { item: this.transformCartItem(response.data) },
        response.message ?? 'Cart item updated',
      );
    } catch (error) {
      return this.handleError<CartItemData>(error);
    }
  }

  /** DELETE /cart/items/:itemId — remove a single item from the cart */
  async removeCartItem(itemId: string): Promise<ClearCartResponse> {
    try {
      await this.request<void>(
        `/api/cart/items/${itemId}`,
        { method: 'DELETE' },
      );

      return createSuccessResponse(null, 'Item removed from cart');
    } catch (error) {
      return this.handleError<null>(error);
    }
  }

  /** DELETE /cart/clear — remove all items from the cart */
  async clearCart(): Promise<ClearCartResponse> {
    try {
      await this.request<void>(
        '/api/cart/clear',
        { method: 'DELETE' },
      );

      return createSuccessResponse(null, 'Cart cleared');
    } catch (error) {
      return this.handleError<null>(error);
    }
  }

  /** POST /cart/coupon — apply a coupon code to the cart */
  async applyCoupon(payload: ApplyCouponDTO): Promise<CouponResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        '/api/cart/coupon',
        {
          method: 'POST',
          // body matches ApplyCouponDTO: { code }
          body: JSON.stringify(payload),
        },
      );

      return createSuccessResponse(
        {
          coupon: this.transformCoupon(response.data.coupon),
          discountAmount: response.data.discountAmount,
        },
        response.message ?? 'Coupon applied successfully',
      );
    } catch (error) {
      return this.handleError<CouponData>(error);
    }
  }

  /** DELETE /cart/coupon — remove the active coupon from the cart */
  async removeCoupon(): Promise<ClearCartResponse> {
    try {
      await this.request<void>(
        '/api/cart/coupon',
        { method: 'DELETE' },
      );

      return createSuccessResponse(null, 'Coupon removed');
    } catch (error) {
      return this.handleError<null>(error);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const cartClient = new CartClient();
export default CartClient;