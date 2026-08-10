import { Router } from 'express';

import { z } from 'zod';
import { AuthTokensController } from '../../../controllers/user/new/account/auth-tokens.controller';
import { authMiddleware } from '../../../middlewares/auth.middleware';

const router = Router();

// Define validation schemas
const TokenQuerySchema = z.object({
  token: z.string().min(6).optional(),
  email: z.string().email().max(255).optional(),
  userId: z.string().cuid().optional(),
});

const TokenParamsSchema = z.object({
  id: z.string().cuid(),
});

const VerifyTokenSchema = z.object({
  type: z.enum(['password', 'twoFactor', 'verification', 'emailChange', 'phoneChange']),
  token: z.string().min(6),
  userId: z.string().cuid().optional(),
});

const GenerateTokenSchema = z.object({
  type: z.enum(['hex', 'numeric']),
  length: z.number().min(4).max(128).optional(),
});

// Apply auth middleware to all routes (optional - adjust based on your needs)

/**
 * @swagger
 * /api/auth-tokens/password-tokens:
 *   get:
 *     summary: Get password token
 *     description: Retrieve a password token by token value or email
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Token value
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         description: User email address
 *     responses:
 *       200:
 *         description: Password token retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Password token not found
 *       500:
 *         description: Server error
 */
router.get(
  '/password-tokens',
  AuthTokensController.getPasswordToken
);

/**
 * @swagger
 * /api/auth-tokens/password-tokens:
 *   post:
 *     summary: Create password token
 *     description: Create a new password reset token
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PasswordTokenInput'
 *     responses:
 *       201:
 *         description: Password token created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post(
  '/password-tokens',
  AuthTokensController.createPasswordToken
);

/**
 * @swagger
 * /api/auth-tokens/password-tokens/{id}:
 *   delete:
 *     summary: Delete password token
 *     description: Delete a specific password token by ID
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Token ID
 *     responses:
 *       200:
 *         description: Password token deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Password token not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/password-tokens/:id',
  AuthTokensController.deletePasswordToken
);

/**
 * @swagger
 * /api/auth-tokens/two-factor-tokens:
 *   get:
 *     summary: Get two-factor token
 *     description: Retrieve a two-factor token by token value or email
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Token value
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         description: User email address
 *     responses:
 *       200:
 *         description: Two-factor token retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Two-factor token not found
 *       500:
 *         description: Server error
 */
router.get(
  '/two-factor-tokens',
  AuthTokensController.getTwoFactorToken
);

/**
 * @swagger
 * /api/auth-tokens/two-factor-tokens:
 *   post:
 *     summary: Create two-factor token
 *     description: Create a new two-factor authentication token
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TwoFactorTokenInput'
 *     responses:
 *       201:
 *         description: Two-factor token created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post(
  '/two-factor-tokens',
  AuthTokensController.createTwoFactorToken
);

/**
 * @swagger
 * /api/auth-tokens/two-factor-tokens/{id}:
 *   delete:
 *     summary: Delete two-factor token
 *     description: Delete a specific two-factor token by ID
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Token ID
 *     responses:
 *       200:
 *         description: Two-factor token deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Two-factor token not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/two-factor-tokens/:id',
  AuthTokensController.deleteTwoFactorToken
);

/**
 * @swagger
 * /api/auth-tokens/verification-tokens:
 *   get:
 *     summary: Get verification token
 *     description: Retrieve a verification token by token value or email
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Token value
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         description: User email address
 *     responses:
 *       200:
 *         description: Verification token retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Verification token not found
 *       500:
 *         description: Server error
 */
router.get(
  '/verification-tokens',
  AuthTokensController.getVerificationToken
);

/**
 * @swagger
 * /api/auth-tokens/verification-tokens:
 *   post:
 *     summary: Create verification token
 *     description: Create a new email verification token
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerificationTokenInput'
 *     responses:
 *       201:
 *         description: Verification token created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post(
  '/verification-tokens',
  AuthTokensController.createVerificationToken
);

/**
 * @swagger
 * /api/auth-tokens/verification-tokens/{id}:
 *   delete:
 *     summary: Delete verification token
 *     description: Delete a specific verification token by ID
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Token ID
 *     responses:
 *       200:
 *         description: Verification token deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Verification token not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/verification-tokens/:id',
  AuthTokensController.deleteVerificationToken
);

/**
 * @swagger
 * /api/auth-tokens/email-change-tokens:
 *   get:
 *     summary: Get email change token
 *     description: Retrieve an email change token by token value or user ID
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Token value
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Email change token retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Email change token not found
 *       500:
 *         description: Server error
 */
router.get(
  '/email-change-tokens',
  authMiddleware,
  AuthTokensController.getEmailChangeToken
);

/**
 * @swagger
 * /api/auth-tokens/email-change-tokens:
 *   post:
 *     summary: Create email change token
 *     description: Create a new email change token
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailChangeTokenInput'
 *     responses:
 *       201:
 *         description: Email change token created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post(
  '/email-change-tokens',
  authMiddleware,
  AuthTokensController.createEmailChangeToken
);

/**
 * @swagger
 * /api/auth-tokens/email-change-tokens/{id}:
 *   delete:
 *     summary: Delete email change token
 *     description: Delete a specific email change token by ID
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Token ID
 *     responses:
 *       200:
 *         description: Email change token deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Email change token not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/email-change-tokens/:id',
  authMiddleware,
  AuthTokensController.deleteEmailChangeToken
);

/**
 * @swagger
 * /api/auth-tokens/phone-change-tokens:
 *   get:
 *     summary: Get phone change token
 *     description: Retrieve a phone change token by token value or user ID
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: Token value
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Phone change token retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Phone change token not found
 *       500:
 *         description: Server error
 */
router.get(
  '/phone-change-tokens',
  AuthTokensController.getPhoneChangeToken
);

/**
 * @swagger
 * /api/auth-tokens/phone-change-tokens:
 *   post:
 *     summary: Create phone change token
 *     description: Create a new phone change token
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PhoneChangeTokenInput'
 *     responses:
 *       201:
 *         description: Phone change token created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post(
  '/phone-change-tokens',
  AuthTokensController.createPhoneChangeToken
);

/**
 * @swagger
 * /api/auth-tokens/phone-change-tokens/{id}:
 *   delete:
 *     summary: Delete phone change token
 *     description: Delete a specific phone change token by ID
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Token ID
 *     responses:
 *       200:
 *         description: Phone change token deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Phone change token not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/phone-change-tokens/:id',
  AuthTokensController.deletePhoneChangeToken
);

/**
 * @swagger
 * /api/auth-tokens/two-factor-confirmations:
 *   get:
 *     summary: Get two-factor confirmation
 *     description: Retrieve two-factor confirmation by user ID
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Two-factor confirmation retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Two-factor confirmation not found
 *       500:
 *         description: Server error
 */
router.get(
  '/two-factor-confirmations',
  AuthTokensController.getTwoFactorConfirmation
);

/**
 * @swagger
 * /api/auth-tokens/two-factor-confirmations:
 *   post:
 *     summary: Create two-factor confirmation
 *     description: Create a new two-factor confirmation
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TwoFactorConfirmationInput'
 *     responses:
 *       201:
 *         description: Two-factor confirmation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post(
  '/two-factor-confirmations',
  AuthTokensController.createTwoFactorConfirmation
);

/**
 * @swagger
 * /api/auth-tokens/two-factor-confirmations/{id}:
 *   delete:
 *     summary: Delete two-factor confirmation
 *     description: Delete a specific two-factor confirmation by ID
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Confirmation ID
 *     responses:
 *       200:
 *         description: Two-factor confirmation deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Two-factor confirmation not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/two-factor-confirmations/:id',
  AuthTokensController.deleteTwoFactorConfirmation
);

/**
 * @swagger
 * /api/auth-tokens/cleanup:
 *   post:
 *     summary: Cleanup expired tokens
 *     description: Clean up all expired authentication tokens
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Expired tokens cleaned up successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       500:
 *         description: Server error
 */
router.post(
  '/cleanup',
  AuthTokensController.cleanupExpiredTokens
);

/**
 * @swagger
 * /api/auth-tokens/user/{userId}:
 *   get:
 *     summary: Get all user tokens
 *     description: Retrieve all authentication tokens for a specific user
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User tokens retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.get(
  '/user/:userId',
  AuthTokensController.getUserTokens
);

/**
 * @swagger
 * /api/auth-tokens/user/{userId}:
 *   delete:
 *     summary: Delete all user tokens
 *     description: Delete all authentication tokens for a specific user
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: All user tokens deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.delete(
  '/user/:userId',
  AuthTokensController.deleteAllUserTokens
);

/**
 * @swagger
 * /api/auth-tokens/verify:
 *   post:
 *     summary: Verify and consume token
 *     description: Verify a token and mark it as consumed
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyTokenInput'
 *     responses:
 *       200:
 *         description: Token verified and consumed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Invalid or expired token
 *       500:
 *         description: Server error
 */
router.post(
  '/verify',
  AuthTokensController.verifyAndConsumeToken
);

/**
 * @swagger
 * /api/auth-tokens/generate:
 *   post:
 *     summary: Generate token
 *     description: Generate a random token (hex or numeric)
 *     tags: [Auth Tokens]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GenerateTokenInput'
 *     responses:
 *       200:
 *         description: Token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post(
  '/generate',
  AuthTokensController.generateToken
);



/**
 * @swagger
 * /api/auth-tokens/verify-backup-code:
 *   post:
 *     summary: Verify backup code
 *     description: Verify a user's backup code for authentication
 *     tags: [Auth Tokens]
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
 *               - backupCode
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User ID (CUID format)
 *                 example: "clxy1234567890abcdef"
 *               backupCode:
 *                 type: string
 *                 description: Backup code to verify
 *                 example: "ABCD-1234-EFGH-5678"
 *     responses:
 *       200:
 *         description: Backup code verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid backup code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
    '/verify-backup-code',
    AuthTokensController.verifyBackupCode
);
export default router;