
"use server"

const origin = process.env.NEXT_PUBLIC_API_BASE_URL

// Type definitions for better type safety
interface UserResponse {
    success: boolean;
    user?: {
        id: string;
        email: string;
        name: string | null;
        emailVerified: Date | null;
        image: string | null;
        role: string;
        isTwoFactorEnabled: boolean;
        password?: string;
    };
    message?: string;
}

interface ErrorResponse {
    success: false;
    message: string;
    status?: number;
}

/**
 * Fetches a user by their email address
 * @param email - The user's email address
 * @param includePassword - Whether to include password in response (default: false)
 * @returns User data or error response
 */
export const getUserByEmail = async (
    email: string,
    includePassword: boolean = false
): Promise<UserResponse | ErrorResponse> => {
    try {
        // Validate email parameter
        if (!email || typeof email !== "string") {
            return {
                success: false,
                message: "Invalid email parameter",
            };
        }

        // Ensure origin is defined (you need to define this)
        const origin = process.env.NEXT_PUBLIC_API_URL;

        if (!origin) {
            return {
                success: false,
                message: "API origin not configured",
            };
        }

        // Build URL with query parameters
        const url = new URL("/api/user", origin);
        url.searchParams.append("email", email);
        if (includePassword) {
            url.searchParams.append("includePassword", "false");
        }

        // Make the fetch request
        const res = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            // Add credentials if using cookies/sessions
            credentials: "include",
        });

        // Parse response
        const data = await res.json();

        // Handle non-OK responses
        if (!res.ok) {
            return {
                success: false,
                message: data.message || `Request failed with status ${res.status}`,
                status: res.status,
            };
        }

        return data;
    } catch (error) {
        console.error("Error fetching user by email:", error);

        return {
            success: false,
            message: error instanceof Error ? error.message : "An unexpected error occurred",
        };
    }
};

// Alternative version with more explicit error handling
export const getUserByEmailAdvanced = async (
    email: string,
    options?: {
        includePassword?: boolean;
        timeout?: number;
    }
): Promise<UserResponse | ErrorResponse> => {
    const { includePassword = false, timeout = 10000 } = options || {};

    try {
        if (!email || typeof email !== "string") {
            return { success: false, message: "Invalid email parameter" };
        }

        const origin = process.env.NEXT_PUBLIC_API_URL ||
            (typeof window !== "undefined" ? window.location.origin : "");

        if (!origin) {
            return { success: false, message: "API origin not configured" };
        }

        const url = new URL("/api/user", origin);
        url.searchParams.append("email", email);
        if (includePassword) {
            url.searchParams.append("includePassword", "true");
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const res = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const data = await res.json();

            if (!res.ok) {
                return {
                    success: false,
                    message: data.message || `HTTP ${res.status}: ${res.statusText}`,
                    status: res.status,
                };
            }

            return data;
        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError instanceof Error && fetchError.name === "AbortError") {
                return {
                    success: false,
                    message: "Request timed out",
                    status: 408,
                };
            }

            throw fetchError;
        }
    } catch (error) {
        console.error("Error fetching user by email:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return {
                success: false,
                message: "Network error: Unable to reach the server",
            };
        }

        return {
            success: false,
            message: error instanceof Error ? error.message : "An unexpected error occurred",
        };
    }
};

export const getUserById = async (id: string) => {
    try {
        const res = await fetch(`${origin}/api/user?id=${id}`);
        if (!res.ok) {
            return { status: res.status, data: res.json(), ok: res.ok }
        }
        return res.json();
    } catch (error) {
        return { message: error };
    }
};



export const updateUserPassword = async (userId: string, data: { password: string }) => {
    try {
        const res = await fetch(`${origin}/api/user/hooks?userId=${userId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
        if (!res.ok) {
            throw new Error("Failed to update user");
        }

        return await res.json();
    } catch (err) {
        return { message: err }
    }
}

export const verifyExistingUser = async (userId: string, data: {
    emailVerified: Date | null,
    email: string
}) => {
    try {
        const res = await fetch(`${origin}/api/user/hooks?userId=${userId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
        if (!res.ok) {
            throw new Error("Failed to VERIFY user");
        }

        return await res.json();
    } catch (err) {
        return { message: err }
    }
}


// create new user

export const createUser = async (data: {
    name: string,
    email: string,
    role: "TENANT" | "MANAGER"
    password: string
    phoneNumber: string
}) => {
    try {
        const res = await fetch(`${origin}/api/user/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
        if (!res.ok) {
            throw new Error("Failed to update user");
        }

        return await res.json()
    } catch (error) {

    }
}




