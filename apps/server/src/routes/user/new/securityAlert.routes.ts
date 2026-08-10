// src/modules/security/securityAlert.routes.ts
import { Router } from 'express';
import { SecurityAlertController } from '../../../controllers/user/new/account/security/securityAlert.controller';

const router = Router();

/**
 * @swagger
 * /api/security/alerts:
 *   post:
 *     summary: Send a security alert
 *     description: Send a security alert notification to a user via multiple channels (notification, email, SMS for high/critical)
 *     tags: [Security Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - type
 *               - message
 *               - severity
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user to send alert to
 *               type:
 *                 type: string
 *                 enum: [ACCOUNT_LOCKED, SUSPICIOUS_LOGIN, PASSWORD_CHANGED, MFA_DISABLED, FAILED_LOGIN_ATTEMPTS, NEW_DEVICE_LOGIN, ACCOUNT_RECOVERY, UNAUTHORIZED_ACCESS]
 *                 description: Type of security alert
 *               message:
 *                 type: string
 *                 description: Alert message
 *               severity:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                 description: Severity level
 *               metadata:
 *                 type: object
 *                 description: Additional metadata for the alert
 *     responses:
 *       200:
 *         description: Security alert sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  '/alerts',
  SecurityAlertController.sendSecurityAlert
);

/**
 * @swagger
 * /api/security/alerts/account-locked:
 *   post:
 *     summary: Send account locked alert
 *     description: Send an alert when a user account is locked due to failed login attempts
 *     tags: [Security Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user whose account is locked
 *               ipAddress:
 *                 type: string
 *                 format: ipv4
 *                 description: IP address of the locked attempt
 *               attempts:
 *                 type: integer
 *                 description: Number of failed attempts
 *     responses:
 *       200:
 *         description: Account locked alert sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  '/account-locked',
  SecurityAlertController.sendAccountLockedAlert
);

/**
 * @swagger
 * /api/security/alerts/failed-login:
 *   post:
 *     summary: Send failed login alert
 *     description: Send an alert when there are multiple failed login attempts
 *     tags: [Security Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - attempts
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user with failed login attempts
 *               attempts:
 *                 type: integer
 *                 minimum: 1
 *                 description: Number of failed attempts
 *               ipAddress:
 *                 type: string
 *                 format: ipv4
 *                 description: IP address of the failed attempts
 *     responses:
 *       200:
 *         description: Failed login alert sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  '/failed-login',
  SecurityAlertController.sendFailedLoginAlert
);

/**
 * @swagger
 * /api/security/alerts/password-changed:
 *   post:
 *     summary: Send password changed alert
 *     description: Send an alert when a user's password is changed
 *     tags: [Security Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user whose password was changed
 *               ipAddress:
 *                 type: string
 *                 format: ipv4
 *                 description: IP address where the change was made
 *     responses:
 *       200:
 *         description: Password changed alert sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  '/password-changed',
  SecurityAlertController.sendPasswordChangedAlert
);

/**
 * @swagger
 * /api/security/alerts/mfa-disabled:
 *   post:
 *     summary: Send MFA disabled alert
 *     description: Send an alert when two-factor authentication is disabled
 *     tags: [Security Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user whose MFA was disabled
 *               ipAddress:
 *                 type: string
 *                 format: ipv4
 *                 description: IP address where MFA was disabled
 *     responses:
 *       200:
 *         description: MFA disabled alert sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  '/mfa-disabled',
  SecurityAlertController.sendMFADisabledAlert
);

/**
 * @swagger
 * /api/security/alerts/new-device-login:
 *   post:
 *     summary: Send new device login alert
 *     description: Send an alert when a user logs in from a new device
 *     tags: [Security Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user logging in from new device
 *               device:
 *                 type: string
 *                 description: Device information
 *               location:
 *                 type: string
 *                 description: Geographic location
 *               ipAddress:
 *                 type: string
 *                 format: ipv4
 *                 description: IP address of the new device
 *     responses:
 *       200:
 *         description: New device login alert sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  '/new-device-login',
  SecurityAlertController.sendNewDeviceLoginAlert
);

/**
 * @swagger
 * /api/security/alerts/suspicious-login:
 *   post:
 *     summary: Send suspicious login alert
 *     description: Send an alert for suspicious login activity
 *     tags: [Security Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - message
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user with suspicious login
 *               message:
 *                 type: string
 *                 description: Suspicious activity details
 *               device:
 *                 type: string
 *                 description: Device information
 *               location:
 *                 type: string
 *                 description: Geographic location
 *               ipAddress:
 *                 type: string
 *                 format: ipv4
 *                 description: IP address of suspicious login
 *     responses:
 *       200:
 *         description: Suspicious login alert sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  '/suspicious-login',
  SecurityAlertController.sendSuspiciousLoginAlert
);

/**
 * @swagger
 * /api/security/alerts/account-recovery:
 *   post:
 *     summary: Send account recovery alert
 *     description: Send an alert when account recovery is initiated
 *     tags: [Security Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user initiating account recovery
 *               message:
 *                 type: string
 *                 description: Recovery process details
 *               ipAddress:
 *                 type: string
 *                 format: ipv4
 *                 description: IP address where recovery was initiated
 *     responses:
 *       200:
 *         description: Account recovery alert sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  '/account-recovery',
  SecurityAlertController.sendAccountRecoveryAlert
);

/**
 * @swagger
 * /api/security/alerts/unauthorized-access:
 *   post:
 *     summary: Send unauthorized access alert
 *     description: Send an alert for unauthorized access attempts
 *     tags: [Security Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - message
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user with unauthorized access attempt
 *               message:
 *                 type: string
 *                 description: Unauthorized access details
 *               ipAddress:
 *                 type: string
 *                 format: ipv4
 *                 description: IP address of unauthorized attempt
 *               userAgent:
 *                 type: string
 *                 description: User agent string
 *               attemptedAction:
 *                 type: string
 *                 description: Action that was attempted
 *     responses:
 *       200:
 *         description: Unauthorized access alert sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  '/unauthorized-access',
  SecurityAlertController.sendUnauthorizedAccessAlert
);

// ============== ADMIN ONLY ENDPOINTS ==============

/**
 * @swagger
 * /api/security/alerts/admin/bulk:
 *   post:
 *     summary: Send bulk security alerts (Admin only)
 *     description: Send multiple security alerts in bulk. Requires admin privileges.
 *     tags: [Security Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - alerts
 *             properties:
 *               alerts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - userId
 *                     - type
 *                     - message
 *                     - severity
 *                   properties:
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     type:
 *                       type: string
 *                       enum: [ACCOUNT_LOCKED, SUSPICIOUS_LOGIN, PASSWORD_CHANGED, MFA_DISABLED, FAILED_LOGIN_ATTEMPTS, NEW_DEVICE_LOGIN, ACCOUNT_RECOVERY, UNAUTHORIZED_ACCESS]
 *                     message:
 *                       type: string
 *                     severity:
 *                       type: string
 *                       enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                     metadata:
 *                       type: object
 *     responses:
 *       200:
 *         description: Bulk alerts processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkAlertsResponse'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */
router.post(
  '/admin/bulk',
  SecurityAlertController.sendBulkSecurityAlerts
);

export default router;