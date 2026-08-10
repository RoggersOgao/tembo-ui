import { Request, Response } from "express";
import { 
  AccountService, 
  AccountSchema,
  AccountFiltersSchema,
  AccountInput 
} from "../../../../services/user/account.service";
import { AuthRequest } from "../../../../middlewares/auth.middleware";
import {
    createSuccessResponse,
    createErrorResponse,
    createValidationErrorResponse,
    createNotFoundResponse,
    createUnauthorizedResponse,
    createConflictResponse,
    createPaginatedResponse,
    ResponseBuilder
} from "@repo/api-utils";
import { z } from "zod";

export class AccountController {
    // Get accounts with filters
    static getAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // Validate query parameters
            const validationResult = AccountFiltersSchema.safeParse(req.query);
            
            if (!validationResult.success) {
                const errors = validationResult.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors, "Invalid query parameters");
                res.status(400).json(response);
                return;
            }

            const filters = validationResult.data;
            const result = await AccountService.getAccounts(filters);

            // Check the type of result
            if (AccountService.isPaginatedAccounts(result)) {
                // Return paginated results
                const response = createPaginatedResponse(
                    result.accounts,
                    result.pagination,
                    "Accounts retrieved successfully"
                );
                res.status(200).json(response);
            } else if (AccountService.isSingleAccount(result)) {
                // Return single account
                const response = ResponseBuilder.success(
                    { account: result },
                    "Account retrieved successfully"
                );
                res.status(200).json(response);
            } else if (AccountService.isAccountArray(result)) {
                // Return array of accounts
                const response = ResponseBuilder.success(
                    { accounts: result },
                    "Accounts retrieved successfully"
                );
                res.status(200).json(response);
            } else {
                // This should never happen
                const response = createErrorResponse(
                    "Unexpected result type from service",
                    "Internal server error"
                );
                res.status(500).json(response);
            }
        } catch (error: any) {
            console.error("Error getting accounts:", error);

            if (error.message.includes("not found")) {
                const response = createNotFoundResponse("Account", error.message);
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while fetching accounts"
                );
                res.status(500).json(response);
            }
        }
    }

    // Get account by ID
    static getAccountById = async (req: AuthRequest, res: Response): Promise<void> => {
        const { id } = req.params as { id: string };
        try {

            if (!id) {
                const response = createValidationErrorResponse(
                    [{ field: 'id', message: 'Account ID is required' }],
                    "Invalid request"
                );
                res.status(400).json(response);
                return;
            }

            const account = await AccountService.getAccountById(id);

            const response = ResponseBuilder.success(
                { account },
                "Account retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            console.error("Error getting account by ID:", error);

            if (error.message.includes("not found")) {
                const response = createNotFoundResponse("Account", id);
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while fetching account"
                );
                res.status(500).json(response);
            }
        }
    }

    // Get account by provider
    static getAccountByProvider = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { provider, providerAccountId } = req.query;

            if (!provider || !providerAccountId) {
                const response = createValidationErrorResponse(
                    [
                        { field: 'provider', message: !provider ? 'Provider is required' : '' },
                        { field: 'providerAccountId', message: !providerAccountId ? 'Provider account ID is required' : '' }
                    ].filter(err => err.message),
                    "Invalid request"
                );
                res.status(400).json(response);
                return;
            }

            const account = await AccountService.getAccountByProvider(
                provider as string, 
                providerAccountId as string
            );

            const response = ResponseBuilder.success(
                { account },
                "Account retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            console.error("Error getting account by provider:", error);

            if (error.message.includes("not found")) {
                const response = createNotFoundResponse("Account", `${req.query.provider} - ${req.query.providerAccountId}`);
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while fetching account"
                );
                res.status(500).json(response);
            }
        }
    }

    // Get accounts by user ID
    static getAccountsByUserId = async (req: AuthRequest, res: Response): Promise<void> => {
        const { userId } = req.params as { userId: string };
        try {

            if (!userId) {
                const response = createValidationErrorResponse(
                    [{ field: 'userId', message: 'User ID is required' }],
                    "Invalid request"
                );
                res.status(400).json(response);
                return;
            }

            const accounts = await AccountService.getAccountsByUserId(userId);

            const response = ResponseBuilder.success(
                { accounts },
                "Accounts retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            console.error("Error getting accounts by user ID:", error);

            if (error.message.includes("not found")) {
                const response = createNotFoundResponse("Accounts", `for user ${req.params.userId}`);
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while fetching accounts"
                );
                res.status(500).json(response);
            }
        }
    }

    // Create a new account
    static createAccount = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // Validate request body
            const validationResult = AccountSchema.safeParse(req.body);
            
            if (!validationResult.success) {
                const errors = validationResult.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors, "Account creation validation failed");
                res.status(400).json(response);
                return;
            }

            const data = validationResult.data;
            const newAccount = await AccountService.createAccount(data);

            const response = ResponseBuilder.success(
                { account: newAccount },
                "Account created successfully"
            );
            res.status(201).json(response);
        } catch (error: any) {
            console.error("Error creating account:", error);

            if (error.message.includes("not found")) {
                const response = createNotFoundResponse("User", (req.body as any)?.userId);
                res.status(404).json(response);
            } else if (error.message.includes("already exists")) {
                const response = createConflictResponse(
                    "Account already exists",
                    error.message
                );
                res.status(409).json(response);
            } else if (error.message.includes("required")) {
                const response = createValidationErrorResponse(
                    [{ field: 'userId', message: error.message }],
                    "Validation failed"
                );
                res.status(400).json(response);
            } else {
                const response = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while creating account"
                );
                res.status(500).json(response);
            }
        }
    }

    // Update account by ID
    static updateAccountById = async (req: AuthRequest, res: Response): Promise<void> => {
        const { id } = req.params as { id: string };
        try {

            if (!id) {
                const response = createValidationErrorResponse(
                    [{ field: 'id', message: 'Account ID is required' }],
                    "Invalid request"
                );
                res.status(400).json(response);
                return;
            }

            // Validate request body
            const validationResult = AccountSchema.partial().safeParse(req.body);
            
            if (!validationResult.success) {
                const errors = validationResult.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors, "Account update validation failed");
                res.status(400).json(response);
                return;
            }

            const updateData = validationResult.data;

            // Remove immutable fields
            if (updateData.userId) delete updateData.userId;
            if (updateData.provider) delete updateData.provider;
            if (updateData.providerAccountId) delete updateData.providerAccountId;

            const updatedAccount = await AccountService.updateAccount(id, updateData);

            const response = ResponseBuilder.success(
                { account: updatedAccount },
                "Account updated successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            console.error("Error updating account:", error);

            if (error.message.includes("not found")) {
                const response = createNotFoundResponse("Account", id);
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while updating account"
                );
                res.status(500).json(response);
            }
        }
    }

    // Delete account by ID
    static deleteAccountById = async (req: AuthRequest, res: Response): Promise<void> => {
        const { id } = req.params as { id: string };
        try {

            if (!id) {
                const response = createValidationErrorResponse(
                    [{ field: 'id', message: 'Account ID is required' }],
                    "Invalid request"
                );
                res.status(400).json(response);
                return;
            }

            const result = await AccountService.deleteAccount(id);

            const response = ResponseBuilder.success(
                { deletedAccount: result },
                "Account deleted successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            console.error("Error deleting account:", error);

            if (error.message.includes("not found")) {
                const response = createNotFoundResponse("Account", id);
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while deleting account"
                );
                res.status(500).json(response);
            }
        }
    }

    // Delete account by provider
    static deleteAccountByProvider = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { provider, providerAccountId } = req.query;

            if (!provider || !providerAccountId) {
                const response = createValidationErrorResponse(
                    [
                        { field: 'provider', message: !provider ? 'Provider is required' : '' },
                        { field: 'providerAccountId', message: !providerAccountId ? 'Provider account ID is required' : '' }
                    ].filter(err => err.message),
                    "Invalid request"
                );
                res.status(400).json(response);
                return;
            }

            const result = await AccountService.deleteAccountByProvider(
                provider as string, 
                providerAccountId as string
            );

            const response = ResponseBuilder.success(
                { deletedAccount: result },
                "Account deleted successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            console.error("Error deleting account by provider:", error);

            if (error.message.includes("not found")) {
                const response = createNotFoundResponse("Account", `${req.query.provider} - ${req.query.providerAccountId}`);
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while deleting account"
                );
                res.status(500).json(response);
            }
        }
    }

    // Delete all accounts for a user
    static deleteUserAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
        const { userId } = req.params as { userId: string };
        try {

            if (!userId) {
                const response = createValidationErrorResponse(
                    [{ field: 'userId', message: 'User ID is required' }],
                    "Invalid request"
                );
                res.status(400).json(response);
                return;
            }

            const result = await AccountService.deleteUserAccounts(userId);

            const response = ResponseBuilder.success(
                result,
                "User accounts deleted successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            console.error("Error deleting user accounts:", error);

            if (error.message.includes("not found")) {
                const response = createNotFoundResponse("Accounts", `for user ${userId}`);
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while deleting accounts"
                );
                res.status(500).json(response);
            }
        }
    }

    // Get account statistics
    static getAccountStats = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const stats = await AccountService.getAccountStats();

            const response = ResponseBuilder.success(
                { stats },
                "Account statistics retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            console.error("Error getting account stats:", error);

            const response = createErrorResponse(
                error.message,
                "An unexpected error occurred while fetching account statistics"
            );
            res.status(500).json(response);
        }
    }

    // Check if user has account with provider
    static checkUserAccount = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { userId, provider } = req.query;

            if (!userId || !provider) {
                const response = createValidationErrorResponse(
                    [
                        { field: 'userId', message: !userId ? 'User ID is required' : '' },
                        { field: 'provider', message: !provider ? 'Provider is required' : '' }
                    ].filter(err => err.message),
                    "Invalid request"
                );
                res.status(400).json(response);
                return;
            }

            const hasAccount = await AccountService.userHasAccount(
                userId as string, 
                provider as string
            );

            const response = ResponseBuilder.success(
                { hasAccount },
                hasAccount ? "User has account with provider" : "User does not have account with provider"
            );
            res.status(200).json(response);
        } catch (error: any) {
            console.error("Error checking user account:", error);

            const response = createErrorResponse(
                error.message,
                "An unexpected error occurred while checking user account"
            );
            res.status(500).json(response);
        }
    }

    // Get user's primary account
    static getPrimaryAccount = async (req: AuthRequest, res: Response): Promise<void> => {
        const { userId } = req.params as { userId: string };
        try {

            if (!userId) {
                const response = createValidationErrorResponse(
                    [{ field: 'userId', message: 'User ID is required' }],
                    "Invalid request"
                );
                res.status(400).json(response);
                return;
            }

            const account = await AccountService.getPrimaryAccount(userId);

            if (!account) {
                const response = createNotFoundResponse("Account", `primary account for user ${userId}`);
                res.status(404).json(response);
                return;
            }

            const response = ResponseBuilder.success(
                { account },
                "Primary account retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            console.error("Error getting primary account:", error);

            const response = createErrorResponse(
                error.message,
                "An unexpected error occurred while fetching primary account"
            );
            res.status(500).json(response);
        }
    }

    // Update account tokens
    static updateAccountTokens = async (req: AuthRequest, res: Response): Promise<void> => {
        const { provider, providerAccountId } = req.params as { provider: string; providerAccountId: string };
        try {
            const { tokens } = req.body;

            if (!provider || !providerAccountId || !tokens) {
                const response = createValidationErrorResponse(
                    [
                        { field: 'provider', message: !provider ? 'Provider is required' : '' },
                        { field: 'providerAccountId', message: !providerAccountId ? 'Provider account ID is required' : '' },
                        { field: 'tokens', message: !tokens ? 'Tokens are required' : '' }
                    ].filter(err => err.message),
                    "Invalid request"
                );
                res.status(400).json(response);
                return;
            }

            // Validate tokens
            const tokenSchema = z.object({
                access_token: z.string().optional(),
                refresh_token: z.string().optional(),
                expires_at: z.number().optional(),
                id_token: z.string().optional(),
                session_state: z.string().optional(),
            });

            const tokenValidation = tokenSchema.safeParse(tokens);
            if (!tokenValidation.success) {
                const errors = tokenValidation.error.errors.map(error => ({
                    field: error.path.join('.'),
                    message: error.message
                }));
                const response = createValidationErrorResponse(errors, "Invalid token data");
                res.status(400).json(response);
                return;
            }

            const updatedAccount = await AccountService.updateAccountTokens(
                provider,
                providerAccountId,
                tokenValidation.data
            );

            const response = ResponseBuilder.success(
                { account: updatedAccount },
                "Account tokens updated successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            console.error("Error updating account tokens:", error);

            if (error.message.includes("not found")) {
                const response = createNotFoundResponse("Account", `${req.params.provider} - ${req.params.providerAccountId}`);
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while updating account tokens"
                );
                res.status(500).json(response);
            }
        }
    }

    // Validate account tokens
    static validateAccountTokens = async (req: AuthRequest, res: Response): Promise<void> => {
        const { id } = req.params as { id: string };
        try {

            if (!id) {
                const response = createValidationErrorResponse(
                    [{ field: 'id', message: 'Account ID is required' }],
                    "Invalid request"
                );
                res.status(400).json(response);
                return;
            }

            const account = await AccountService.getAccountById(id);
            const validation = await AccountService.validateAccountTokens(account);

            const response = ResponseBuilder.success(
                { validation, account },
                "Account tokens validated successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            console.error("Error validating account tokens:", error);

            if (error.message.includes("not found")) {
                const response = createNotFoundResponse("Account", id);
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while validating account tokens"
                );
                res.status(500).json(response);
            }
        }
    }

    // Get my accounts (authenticated user)
    static getMyAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            // Get user ID from auth middleware
            const userId = req.user?.userId;

            if (!userId) {
                const response = createUnauthorizedResponse("User not authenticated");
                res.status(401).json(response);
                return;
            }

            const accounts = await AccountService.getAccountsByUserId(userId);

            const response = ResponseBuilder.success(
                { accounts },
                "Accounts retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            console.error("Error getting my accounts:", error);

            if (error.message.includes("not found")) {
                const response = createNotFoundResponse(
                    "Accounts",
                    `for user ${req.user?.userId}`
                );
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while fetching accounts"
                );
                res.status(500).json(response);
            }
        }
    }

    // Delete my account (authenticated user)
    static deleteMyAccount = async (req: AuthRequest, res: Response): Promise<void> => {
            const userId = req.user?.userId;
            const { id } = req.params as { id: string };
        try {
            // Get user ID from auth middleware

            if (!userId) {
                const response = createUnauthorizedResponse("User not authenticated");
                res.status(401).json(response);
                return;
            }

            if (!id) {
                const response = createValidationErrorResponse(
                    [{ field: 'id', message: 'Account ID is required' }],
                    "Invalid request"
                );
                res.status(400).json(response);
                return;
            }

            // Verify the account belongs to the authenticated user
            const account = await AccountService.getAccountById(id);
            if (account.userId !== userId) {
                const response = createUnauthorizedResponse("You can only delete your own accounts");
                res.status(403).json(response);
                return;
            }

            const result = await AccountService.deleteAccount(id);

            const response = ResponseBuilder.success(
                { deletedAccount: result },
                "Account deleted successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            console.error("Error deleting my account:", error);

            if (error.message.includes("not found")) {
                const response = createNotFoundResponse("Account", id);
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message,
                    "An unexpected error occurred while deleting account"
                );
                res.status(500).json(response);
            }
        }
    }
}