import { db, Prisma } from "@repo/database";
import { z } from "zod";
import crypto from "crypto";

// Schema for creating/updating account
export const AccountSchema = z.object({
  userId: z.string().cuid(),
  type: z.string(),
  provider: z.string(),
  providerAccountId: z.string(),
  refresh_token: z.string().optional(),
  access_token: z.string().optional(),
  expires_at: z.number().optional(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  id_token: z.string().optional(),
  session_state: z.string().optional(),
});

export type AccountInput = z.infer<typeof AccountSchema>;

// Schema for account filters
export const AccountFiltersSchema = z.object({
  userId: z.string().cuid().optional(),
  provider: z.string().optional(),
  type: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type AccountFilters = z.infer<typeof AccountFiltersSchema>;

export interface AccountWithUser {
  id: string;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedAccounts {
  accounts: AccountWithUser[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface AccountStats {
  totalAccounts: number;
  byProvider: Record<string, number>;
  byType: Record<string, number>;
  usersWithMultipleAccounts: number;
  recentlyConnected: AccountWithUser[];
}

export class AccountService {
  /**
   * Get all accounts or filtered accounts
   */
  static async getAccounts(filters?: AccountFilters): Promise<AccountWithUser | PaginatedAccounts> {
    const {
      userId,
      provider,
      type,
      search,
      page = 1,
      limit = 20
    } = filters || {};

    // If userId is provided, get accounts for that user
    if (userId) {
      const accounts = await db.account.findMany({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true,
            }
          }
        }
      });

      if (accounts.length === 0) {
        throw new Error(`No accounts found for user ${userId}`);
      }

      // If only one account, return it directly
      if (accounts.length === 1) {
        return accounts[0] as AccountWithUser;
      }

      return {
        accounts: accounts as AccountWithUser[],
        pagination: {
          total: accounts.length,
          page: 1,
          limit: accounts.length,
          totalPages: 1,
          hasMore: false,
        }
      };
    }

    // Build where clause for filtering
    const where: Prisma.AccountWhereInput = {};

    if (provider) {
      where.provider = provider;
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { provider: { contains: search, mode: 'insensitive' as const } },
        { providerAccountId: { contains: search, mode: 'insensitive' as const } },
        {
          user: {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } }
            ]
          }
        }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries in parallel
    const [accounts, total] = await Promise.all([
      db.account.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.account.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      accounts: accounts as AccountWithUser[],
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      }
    };
  }

  /**
   * Get account by ID
   */
  static async getAccountById(id: string): Promise<AccountWithUser> {
    const account = await db.account.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          }
        }
      }
    });

    if (!account) {
      throw new Error(`Account with ID ${id} not found`);
    }

    return account as AccountWithUser;
  }

  /**
   * Get account by provider and providerAccountId
   */
 static async getAccountByProvider(provider: string, providerAccountId: string): Promise<AccountWithUser> {
  const account = await db.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId
      }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
        }
      }
    }
  });

  if (!account) {
    throw new Error(`Account not found for provider ${provider} and account ID ${providerAccountId}`);
  }

  return {
    ...account,
    updatedAt: account.updatedAt ?? new Date(),
    user: {
      ...account.user,
      role: account.user.role as string,
    }
  };
}

  /**
   * Get accounts by user ID
   */
  static async getAccountsByUserId(userId: string): Promise<AccountWithUser[]> {
    const accounts = await db.account.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (accounts.length === 0) {
      throw new Error(`No accounts found for user ${userId}`);
    }

    return accounts as AccountWithUser[];
  }

  /**
   * Create a new account
   */
  static async createAccount(data: AccountInput): Promise<AccountWithUser> {
    // Validate required fields
    if (!data.userId || !data.provider || !data.providerAccountId) {
      throw new Error("User ID, provider, and provider account ID are required");
    }

    // Check if user exists
    const user = await db.user.findUnique({
      where: { id: data.userId }
    });

    if (!user) {
      throw new Error(`User with ID ${data.userId} not found`);
    }

    // Check if account already exists for this provider and providerAccountId
    const existingAccount = await db.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: data.provider,
          providerAccountId: data.providerAccountId
        }
      }
    });

    if (existingAccount) {
      throw new Error(`Account already exists for provider ${data.provider} and account ID ${data.providerAccountId}`);
    }

    // Create the account
    const newAccount = await db.account.create({
      data: {
        userId: data.userId,
        type: data.type,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        refresh_token: data.refresh_token,
        access_token: data.access_token,
        expires_at: data.expires_at,
        token_type: data.token_type,
        scope: data.scope,
        id_token: data.id_token,
        session_state: data.session_state,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          }
        }
      }
    });

    return newAccount as AccountWithUser;
  }

  /**
   * Update an account
   */
  static async updateAccount(id: string, data: Partial<AccountInput>): Promise<AccountWithUser> {
    // Check if account exists
    const existingAccount = await db.account.findUnique({
      where: { id }
    });

    if (!existingAccount) {
      throw new Error(`Account with ID ${id} not found`);
    }

    // Prepare update data
    const updateData: any = {};

    // Map all fields from input data
    Object.keys(data).forEach(key => {
      const value = data[key as keyof AccountInput];
      if (value !== undefined && key !== 'userId' && key !== 'provider' && key !== 'providerAccountId') {
        updateData[key] = value;
      }
    });

    const updatedAccount = await db.account.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          }
        }
      }
    });

    return updatedAccount as AccountWithUser;
  }

  /**
   * Delete an account
   */
  static async deleteAccount(id: string): Promise<{ id: string; userId: string; provider: string }> {
    // Check if account exists
    const existingAccount = await db.account.findUnique({
      where: { id }
    });

    if (!existingAccount) {
      throw new Error(`Account with ID ${id} not found`);
    }

    await db.account.delete({
      where: { id },
    });

    return {
      id,
      userId: existingAccount.userId,
      provider: existingAccount.provider
    };
  }

  /**
   * Delete account by provider and providerAccountId
   */
  static async deleteAccountByProvider(provider: string, providerAccountId: string): Promise<{ id: string; userId: string; provider: string }> {
    // Check if account exists
    const existingAccount = await db.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId
        }
      }
    });

    if (!existingAccount) {
      throw new Error(`Account not found for provider ${provider} and account ID ${providerAccountId}`);
    }

    await db.account.delete({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId
        }
      },
    });

    return {
      id: existingAccount.id,
      userId: existingAccount.userId,
      provider: existingAccount.provider
    };
  }

  /**
   * Delete all accounts for a user
   */
  static async deleteUserAccounts(userId: string): Promise<{ count: number; providers: string[] }> {
    // Get user's accounts before deletion
    const userAccounts = await db.account.findMany({
      where: { userId },
      select: { id: true, provider: true }
    });

    if (userAccounts.length === 0) {
      throw new Error(`No accounts found for user ${userId}`);
    }

    await db.account.deleteMany({
      where: { userId },
    });

    return {
      count: userAccounts.length,
      providers: userAccounts.map(account => account.provider)
    };
  }

  /**
   * Get account statistics
   */
  static async getAccountStats(): Promise<AccountStats> {
    const [
      totalAccounts,
      accountsByProvider,
      accountsByType,
      usersWithMultipleAccounts,
      recentlyConnected
    ] = await Promise.all([
      // Total accounts
      db.account.count(),

      // Accounts by provider
      (async () => {
        const providerCounts = await db.account.groupBy({
          by: ['provider'],
          _count: { _all: true },
        });

        const result: Record<string, number> = {};
        providerCounts.forEach(item => {
          result[item.provider] = item._count._all;
        });
        return result;
      })(),

      // Accounts by type
      (async () => {
        const typeCounts = await db.account.groupBy({
          by: ['type'],
          _count: { _all: true },
        });

        const result: Record<string, number> = {};
        typeCounts.forEach(item => {
          result[item.type] = item._count._all;
        });
        return result;
      })(),

      // Users with multiple accounts
      (async () => {
        const userAccountCounts = await db.account.groupBy({
          by: ['userId'],
          _count: {
            userId: true
          },
          having: {
            userId: {
              _count: {
                gt: 1
              }
            }
          }
        });
        return userAccountCounts.length;
      })(),

      // Recently connected
      db.account.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true,
            }
          }
        }
      })
    ]);

    return {
      totalAccounts,
      byProvider: accountsByProvider,
      byType: accountsByType,
      usersWithMultipleAccounts,
      recentlyConnected: recentlyConnected as AccountWithUser[],
    };
  }

  /**
   * Check if user has account with provider
   */
  static async userHasAccount(userId: string, provider: string): Promise<boolean> {
    const account = await db.account.findFirst({
      where: {
        userId,
        provider
      }
    });
    return !!account;
  }

  /**
   * Get user's primary account (first account by creation date)
   */
  static async getPrimaryAccount(userId: string): Promise<AccountWithUser | null> {
    const account = await db.account.findFirst({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return account as AccountWithUser;
  }

  /**
   * Update account tokens
   */
  static async updateAccountTokens(
    provider: string,
    providerAccountId: string,
    tokens: {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
      id_token?: string;
      session_state?: string;
    }
  ): Promise<AccountWithUser> {
    const account = await this.getAccountByProvider(provider, providerAccountId);

    const updateData: any = {};
    if (tokens.access_token !== undefined) updateData.access_token = tokens.access_token;
    if (tokens.refresh_token !== undefined) updateData.refresh_token = tokens.refresh_token;
    if (tokens.expires_at !== undefined) updateData.expires_at = tokens.expires_at;
    if (tokens.id_token !== undefined) updateData.id_token = tokens.id_token;
    if (tokens.session_state !== undefined) updateData.session_state = tokens.session_state;

    const updatedAccount = await db.account.update({
      where: { id: account.id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          }
        }
      }
    });

    return updatedAccount as AccountWithUser;
  }

  /**
   * Validate account tokens
   */
  static async validateAccountTokens(account: AccountWithUser): Promise<{
    isValid: boolean;
    isExpired: boolean;
    expiresIn?: number;
  }> {
    if (!account.expires_at) {
      return { isValid: true, isExpired: false };
    }

    const now = Math.floor(Date.now() / 1000);
    const isExpired = account.expires_at < now;
    const expiresIn = account.expires_at - now;

    return {
      isValid: !isExpired,
      isExpired,
      expiresIn: expiresIn > 0 ? expiresIn : undefined
    };
  }

  /**
   * Type guard to check if result is paginated
   */
  static isPaginatedAccounts(result: AccountWithUser | AccountWithUser[] | PaginatedAccounts): result is PaginatedAccounts {
    return 'pagination' in result && 'accounts' in result;
  }

  /**
   * Type guard to check if result is a single account
   */
  static isSingleAccount(result: AccountWithUser | AccountWithUser[] | PaginatedAccounts): result is AccountWithUser {
    return 'id' in result && 'userId' in result && !('pagination' in result) && !Array.isArray(result);
  }

  /**
   * Type guard to check if result is an array of accounts
   */
  static isAccountArray(result: AccountWithUser | AccountWithUser[] | PaginatedAccounts): result is AccountWithUser[] {
    return Array.isArray(result) && result.length > 0 && 'id' in result[0];
  }
}