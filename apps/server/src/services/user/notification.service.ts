// services/notification/notification.service.ts
import {
  db,
  Prisma,
  Notification,
  NotificationType,
  NotificationChannel,
} from '@repo/database';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  channel?: NotificationChannel;
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  actionUrl?: string;
}

export interface NotificationFilters {
  isRead?: boolean;
  type?: NotificationType;
  startDate?: Date;
  endDate?: Date;
  /** Searches title and body */
  search?: string;
}

export interface GetUserNotificationsOptions {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt';   // Notification has no updatedAt
  sortOrder?: 'asc' | 'desc';
  filters?: NotificationFilters;
}

export interface PaginatedNotifications {
  notifications: Notification[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Partial<Record<NotificationType, number>>;
  recentCount: number;
}

export class NotificationService {
  /**
   * Create a new notification
   */
  static async createNotification(
    data: CreateNotificationInput
  ): Promise<Notification> {
    return db.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        channel: data.channel ?? NotificationChannel.IN_APP,
        title: data.title,
        body: data.body,
        data: data.data ? (data.data as Prisma.InputJsonValue) : Prisma.JsonNull,
        imageUrl: data.imageUrl,
        actionUrl: data.actionUrl,
        isRead: false,
      },
    });
  }

  /**
   * Create multiple notifications in bulk
   */
  static async createBatchNotifications(
    inputs: CreateNotificationInput[]
  ): Promise<Notification[]> {
    return db.$transaction(
      inputs.map((input) =>
        db.notification.create({
          data: {
            userId: input.userId,
            type: input.type,
            channel: input.channel ?? NotificationChannel.IN_APP,
            title: input.title,
            body: input.body,
            data: input.data ? (input.data as Prisma.InputJsonValue) : Prisma.JsonNull,
            imageUrl: input.imageUrl,
            actionUrl: input.actionUrl,
            isRead: false,
          },
        })
      )
    );
  }

  /**
   * Get notification by ID
   */
  static async getNotificationById(id: string): Promise<Notification> {
    const notification = await db.notification.findUnique({ where: { id } });

    if (!notification) throw new Error('Notification not found');

    return notification;
  }

  /**
   * Get user notifications with pagination and filtering
   */
  static async getUserNotifications(
    userId: string,
    options: GetUserNotificationsOptions = {}
  ): Promise<PaginatedNotifications> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      filters = {},
    } = options;

    const where: Prisma.NotificationWhereInput = { userId };

    if (filters.isRead !== undefined) {
      where.isRead = filters.isRead;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {
        ...(filters.startDate && { gte: filters.startDate }),
        ...(filters.endDate && { lte: filters.endDate }),
      };
    }

    // type is an enum — only title and body support text search
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { body: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      db.notification.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      notifications,
      total,
      totalPages,
      page,
      limit,
      hasMore: page < totalPages,
    };
  }

  /**
   * Get unread notification count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return db.notification.count({ where: { userId, isRead: false } });
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(id: string): Promise<Notification> {
    try {
      return await db.notification.update({
        where: { id },
        data: { isRead: true, readAt: new Date() },
      });
    } catch {
      throw new Error('Notification not found');
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { count: result.count };
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(
    id: string
  ): Promise<{ id: string; userId: string }> {
    const existing = await db.notification.findUnique({ where: { id } });

    if (!existing) throw new Error('Notification not found');

    await db.notification.delete({ where: { id } });

    return { id, userId: existing.userId };
  }

  /**
   * Delete all notifications for a user
   */
  static async deleteUserNotifications(userId: string): Promise<{ count: number }> {
    const result = await db.notification.deleteMany({ where: { userId } });
    return { count: result.count };
  }

  /**
   * Get notification statistics for a user
   */
  static async getNotificationStats(userId: string): Promise<NotificationStats> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [total, unread, typeCounts, recentCount] = await Promise.all([
      db.notification.count({ where: { userId } }),

      db.notification.count({ where: { userId, isRead: false } }),

      db.notification.groupBy({
        by: ['type'],
        where: { userId },
        _count: { _all: true },
      }),

      db.notification.count({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
      }),
    ]);

    const byType: Partial<Record<NotificationType, number>> = {};
    for (const item of typeCounts) {
      byType[item.type] = item._count._all;
    }

    return { total, unread, byType, recentCount };
  }

  /**
   * Get distinct notification types used by a user
   */
  static async getNotificationTypes(userId: string): Promise<NotificationType[]> {
    const rows = await db.notification.findMany({
      where: { userId },
      distinct: ['type'],
      select: { type: true },
    });

    return rows.map((r) => r.type);
  }

  /**
   * Update a notification's read state, title, or body
   */
  static async updateNotification(
    id: string,
    data: {
      isRead?: boolean;
      title?: string;
      body?: string;
      data?: Record<string, any>;
    }
  ): Promise<Notification> {
    try {
      return await db.notification.update({
        where: { id },
        data: {
          ...data,
          ...(data.isRead === true && { readAt: new Date() }),
          ...(data.data && { data: data.data as Prisma.InputJsonValue }),
        },
      });
    } catch {
      throw new Error('Notification not found');
    }
  }

  /**
   * Delete read notifications older than `days` days
   */
  static async cleanupOldNotifications(days = 30): Promise<{ count: number }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await db.notification.deleteMany({
      where: { isRead: true, createdAt: { lt: cutoff } },
    });

    return { count: result.count };
  }

  /**
   * Check whether a notification belongs to a given user
   */
  static async isNotificationOwner(
    notificationId: string,
    userId: string
  ): Promise<boolean> {
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
      select: { userId: true },
    });

    return notification?.userId === userId;
  }
}