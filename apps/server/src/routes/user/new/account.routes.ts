import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { AccountController } from '../../../controllers/user/new/account/account.controller';


const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/accounts:
 *   get:
 *     summary: Get accounts with filters
 *     description: Retrieve accounts with various filtering options. Can return single account, array, or paginated results.
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *         description: Filter by OAuth provider
 *       - in: query
 *         name: providerAccountId
 *         schema:
 *           type: string
 *         description: Filter by provider account ID
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
 *           default: 10
 *           maximum: 100
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Accounts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/SingleAccountResponse'
 *                 - $ref: '#/components/schemas/AccountArrayResponse'
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Account not found
 *       500:
 *         description: Server error
 */
router.get(
  '/',
  AccountController.getAccounts
);

/**
 * @swagger
 * /api/accounts/me:
 *   get:
 *     summary: Get my accounts
 *     description: Get all accounts for the authenticated user
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Accounts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccountArrayResponse'
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: No accounts found
 *       500:
 *         description: Server error
 */
router.get(
  '/me',
  AccountController.getMyAccounts
);

/**
 * @swagger
 * /api/accounts/{id}:
 *   get:
 *     summary: Get account by ID
 *     description: Retrieve detailed information about a specific account
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Account ID
 *     responses:
 *       200:
 *         description: Account details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SingleAccountResponse'
 *       400:
 *         description: Missing account ID
 *       404:
 *         description: Account not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:id',
  AccountController.getAccountById
);

/**
 * @swagger
 * /api/accounts/providers:
 *   get:
 *     summary: Get account by provider
 *     description: Retrieve an account by provider and provider account ID
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *         description: OAuth provider (google, github, etc.)
 *       - in: query
 *         name: providerAccountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider account ID
 *     responses:
 *       200:
 *         description: Account retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SingleAccountResponse'
 *       400:
 *         description: Missing provider or providerAccountId
 *       404:
 *         description: Account not found
 *       500:
 *         description: Server error
 */
router.get(
  '/providers',
  AccountController.getAccountByProvider
);

/**
 * @swagger
 * /api/accounts/users/{userId}:
 *   get:
 *     summary: Get accounts by user ID
 *     description: Retrieve all accounts for a specific user
 *     tags: [Accounts]
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
 *         description: Accounts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccountArrayResponse'
 *       400:
 *         description: Missing user ID
 *       404:
 *         description: No accounts found for user
 *       500:
 *         description: Server error
 */
router.get(
  '/users/:userId',
  AccountController.getAccountsByUserId
);

/**
 * @swagger
 * /api/accounts/users/{userId}/primary:
 *   get:
 *     summary: Get user's primary account
 *     description: Retrieve the primary account for a user
 *     tags: [Accounts]
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
 *         description: Primary account retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SingleAccountResponse'
 *       400:
 *         description: Missing user ID
 *       404:
 *         description: Primary account not found
 *       500:
 *         description: Server error
 */
router.get(
  '/users/:userId/primary',
  AccountController.getPrimaryAccount
);

/**
 * @swagger
 * /api/accounts:
 *   post:
 *     summary: Create a new account
 *     description: Create a new OAuth account for a user
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAccountInput'
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SingleAccountResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       409:
 *         description: Account already exists
 *       500:
 *         description: Server error
 */
router.post(
  '/',
  AccountController.createAccount
);

/**
 * @swagger
 * /api/accounts/{id}:
 *   put:
 *     summary: Update account by ID
 *     description: Update an account's information (excluding immutable fields)
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Account ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAccountInput'
 *     responses:
 *       200:
 *         description: Account updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SingleAccountResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Account not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:id',
  AccountController.updateAccountById
);

/**
 * @swagger
 * /api/accounts/{id}/tokens/validate:
 *   post:
 *     summary: Validate account tokens
 *     description: Validate OAuth tokens for an account
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Account ID
 *     responses:
 *       200:
 *         description: Tokens validated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenValidationResponse'
 *       400:
 *         description: Missing account ID
 *       404:
 *         description: Account not found
 *       500:
 *         description: Server error
 */
router.post(
  '/:id/tokens/validate',
  AccountController.validateAccountTokens
);

/**
 * @swagger
 * /api/accounts/{id}:
 *   delete:
 *     summary: Delete account by ID
 *     description: Delete a specific account by ID
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Account ID
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteAccountResponse'
 *       400:
 *         description: Missing account ID
 *       403:
 *         description: Unauthorized (when deleting others' accounts)
 *       404:
 *         description: Account not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/:id',
  AccountController.deleteAccountById
);

/**
 * @swagger
 * /api/accounts/me/{id}:
 *   delete:
 *     summary: Delete my account
 *     description: Delete one of the authenticated user's accounts
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Account ID
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteAccountResponse'
 *       400:
 *         description: Missing account ID
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Cannot delete other users' accounts
 *       404:
 *         description: Account not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/me/:id',
  AccountController.deleteMyAccount
);

/**
 * @swagger
 * /api/accounts/providers:
 *   delete:
 *     summary: Delete account by provider
 *     description: Delete an account by provider and provider account ID
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *         description: OAuth provider
 *       - in: query
 *         name: providerAccountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider account ID
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteAccountResponse'
 *       400:
 *         description: Missing provider or providerAccountId
 *       404:
 *         description: Account not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/providers',
  AccountController.deleteAccountByProvider
);

/**
 * @swagger
 * /api/accounts/users/{userId}:
 *   delete:
 *     summary: Delete all user accounts
 *     description: Delete all accounts for a specific user
 *     tags: [Accounts]
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
 *         description: All user accounts deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkDeleteResponse'
 *       400:
 *         description: Missing user ID
 *       404:
 *         description: No accounts found for user
 *       500:
 *         description: Server error
 */
router.delete(
  '/users/:userId',
  AccountController.deleteUserAccounts
);

/**
 * @swagger
 * /api/accounts/check:
 *   get:
 *     summary: Check if user has account with provider
 *     description: Check if a user has an account with a specific OAuth provider
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *         description: OAuth provider
 *     responses:
 *       200:
 *         description: Check completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccountCheckResponse'
 *       400:
 *         description: Missing userId or provider
 *       500:
 *         description: Server error
 */
router.get(
  '/check',
  AccountController.checkUserAccount
);

/**
 * @swagger
 * /api/accounts/stats:
 *   get:
 *     summary: Get account statistics
 *     description: Get statistics about OAuth accounts
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccountStatsResponse'
 *       500:
 *         description: Server error
 */
router.get(
  '/stats',
  AccountController.getAccountStats
);

/**
 * @swagger
 * /api/accounts/{provider}/{providerAccountId}/tokens:
 *   put:
 *     summary: Update account tokens
 *     description: Update OAuth tokens for an account
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *         description: OAuth provider
 *       - in: path
 *         name: providerAccountId
 *         required: true
 *         schema:
 *           type: string
 *         description: Provider account ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateTokensInput'
 *     responses:
 *       200:
 *         description: Tokens updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SingleAccountResponse'
 *       400:
 *         description: Missing parameters or invalid token data
 *       404:
 *         description: Account not found
 *       500:
 *         description: Server error
 */
router.put(
  '/:provider/:providerAccountId/tokens',
  AccountController.updateAccountTokens
);

export default router;