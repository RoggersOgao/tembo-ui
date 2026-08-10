// src/modules/notification/notification.routes.ts
import { Router } from 'express';
import { NotificationController } from '../../../controllers/user/new/account/notification.controller';
import { authMiddleware, requireRole } from '../../../middlewares/auth.middleware';
const router = Router();


/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Create a new notification
 *     description: Create and send a notification to a specific user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNotificationInput'
 *     responses:
 *       201:
 *         description: Notification created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SingleNotificationResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  NotificationController.createNotification
);

/**
 * @swagger
 * /api/notifications/users/{userId}:
 *   get:
 *     summary: Get user notifications
 *     description: Retrieve notifications for a specific user with pagination and filtering options
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *         description: Filter by read status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by notification type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in notification content
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, type]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedNotificationsResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get(
  '/users/:userId',
  NotificationController.getUserNotifications
);

/**
 * @swagger
 * /api/notifications/{id}:
 *   get:
 *     summary: Get notification by ID
 *     description: Retrieve a specific notification by its ID
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SingleNotificationResponse'
 *       400:
 *         description: Invalid notification ID
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:id',
  NotificationController.getNotificationById
);

/**
 * @swagger
 * /api/notifications/{id}:
 *   put:
 *     summary: Update notification
 *     description: Update a notification (mark as read, update message, etc.)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateNotificationInput'
 *     responses:
 *       200:
 *         description: Notification updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SingleNotificationResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:id',
  NotificationController.updateNotification
);

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     description: Delete a specific notification
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteNotificationResponse'
 *       400:
 *         description: Invalid notification ID
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/:id',
  NotificationController.deleteNotification
);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Mark notification as read
 *     description: Mark a specific notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SingleNotificationResponse'
 *       400:
 *         description: Invalid notification ID
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:id/read',
  NotificationController.markAsRead
);

/**
 * @swagger
 * /api/notifications/users/{userId}/mark-all-read:
 *   put:
 *     summary: Mark all notifications as read
 *     description: Mark all unread notifications as read for a specific user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MarkAllReadResponse'
 *       400:
 *         description: Invalid user ID
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put(
  '/users/:userId/mark-all-read',
  NotificationController.markAllAsRead
);

/**
 * @swagger
 * /api/notifications/users/{userId}/unread/count:
 *   get:
 *     summary: Get unread notifications count
 *     description: Get the count of unread notifications for a user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: Unread count retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnreadCountResponse'
 *       400:
 *         description: Invalid user ID
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get(
  '/users/:userId/unread/count',
  NotificationController.getUnreadCount
);

/**
 * @swagger
 * /api/notifications/users/{userId}/stats:
 *   get:
 *     summary: Get notification statistics
 *     description: Get statistics about user notifications (total, unread, by type, recent)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: Notification statistics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationStatsResponse'
 *       400:
 *         description: Invalid user ID
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get(
  '/users/:userId/stats',
  NotificationController.getNotificationStats
);

/**
 * @swagger
 * /api/notifications/users/{userId}/types:
 *   get:
 *     summary: Get notification types
 *     description: Get distinct notification types for a user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: Notification types retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationTypesResponse'
 *       400:
 *         description: Invalid user ID
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get(
  '/users/:userId/types',
  NotificationController.getNotificationTypes
);

/**
 * @swagger
 * /api/notifications/check-ownership/{notificationId}/{userId}:
 *   get:
 *     summary: Check notification ownership
 *     description: Check if a notification belongs to a specific user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: Ownership check completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OwnershipCheckResponse'
 *       400:
 *         description: Invalid IDs
 *       500:
 *         description: Server error
 */
router.get(
  '/check-ownership/:notificationId/:userId',
  requireRole('DELIVERY', 'ADMIN', "SUPER_ADMIN",'CUSTOMER', 'VIEWER','SUPPLIER'),
  NotificationController.checkNotificationOwnership
);

// ============== ADMIN ONLY ENDPOINTS ==============

/**
 * @swagger
 * /api/notifications/admin/bulk:
 *   post:
 *     summary: Create batch notifications (Admin only)
 *     description: Create multiple notifications in bulk. Requires admin privileges.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchNotificationsInput'
 *     responses:
 *       201:
 *         description: Batch notifications created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BatchNotificationsResponse'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */
router.post(
  '/admin/bulk',
  authMiddleware,
  requireRole('ADMIN'),
  NotificationController.createBatchNotifications
);

/**
 * @swagger
 * /api/notifications/admin/cleanup:
 *   delete:
 *     summary: Clean up old notifications (Admin only)
 *     description: Delete old read notifications. Requires admin privileges.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: Number of days (notifications older than this will be deleted)
 *     responses:
 *       200:
 *         description: Old notifications cleaned up
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CleanupResponse'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */
router.delete(
  '/admin/cleanup',
  authMiddleware,
  requireRole('ADMIN'),
  NotificationController.cleanupOldNotifications
);

export const notificationRoutes = router;