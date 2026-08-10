// ============================================
// lib/upload-api.ts - Upload API Client
// ============================================
import { getToken } from "@/lib/get-token"
import { method } from "lodash";

interface PhotoData {
    key: string;
    name: string;
    size: number;
    type: string;
    width: number;
    height: number;
}

interface PresignZipResponse {
    uploadUrl: string;
    uploadKey: string;
    siteId: string;
    site: any;
}

interface PresignImageResponse {
    uploadUrl: string;
    key: string;
}

class UploadApiClient {
    private baseURL: string;

    constructor() {
        this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
    }

    /**
     * @description Generic request handler with automatic token injection
     * @param endpoint - The API endpoint path
     * @param options - Standard RequestInit options
     * @param requireAuth - If true, requires authentication token
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        requireAuth: boolean = true
    ): Promise<T> {
        let token: string | undefined | null;

        if (requireAuth) {
            token = await getToken();

            if (!token) {
                throw new Error("Authorization token is missing. Please log in.");
            }
        }

        const headers: HeadersInit = {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        };

        const res = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            credentials: "include",
            headers,
        });

        if (res.status === 401) {
            console.log("Unauthorized upload request");
            throw new Error("Unauthorized");
        }

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Request failed: ${res.status} ${text}`);
        }

        return res.json();
    }

    // --- Public API Methods ---

    /**
     * Get authentication token for Socket.IO or other services
     */
    async getAuthToken(): Promise<string | null> {
        return  await getToken();
    }

    /**
     * Get Socket.IO server URL
     */
    async getSocketUrl(): Promise<string> {
        const token = await getToken()

        if (!token) {
            throw new Error("Authentication required for Socket.IO connection");
        }

        // Socket.IO will be on the same domain as the API
        const url = new URL(this.baseURL);

        // Use wss:// for https:// and ws:// for http://
        const protocol = url.protocol === "https:" ? "wss:" : "ws:";

        // Return just the base URL - Socket.IO client will handle the rest
        return `${protocol}//${url.host}`;
    }

    /**
     * Request a presigned URL for ZIP file upload
     */
    async presignForZip(
        filename: string,
        contentType: string,
        name?: string
    ): Promise<PresignZipResponse> {
        return this.request<PresignZipResponse>("/kukushop-uploads/presign", {
            method: "POST",
            body: JSON.stringify({ filename, contentType, name }),
        });
    }

    /**
     * Complete the upload after file is uploaded to S3
     */
    async completeUpload(
        clientId: string,
        siteId: string,
        uploadKey: string,
        photos: PhotoData[] = []
    ): Promise<void> {
        return this.request<void>(
            `/kukushop-uploads/images/complete?clientId=${clientId}`,
            {
                method: "POST",
                body: JSON.stringify({ siteId, uploadKey, photos }),
            }
        );
    }

    /**
     * Request a presigned URL for image upload
     */
    async presignImage(
        sku: string,
        filename: string,
        contentType: string
    ): Promise<PresignImageResponse> {
        return this.request<PresignImageResponse>("/kukushop-uploads/presign-image", {
            method: "POST",
            body: JSON.stringify({ sku, filename, contentType }),
        });
    }

    /**
     * Register an uploaded image with the backend
     */
    async registerImage(
        siteId: string,
        key: string,
        filename: string,
        size: number,
        contentType?: string
    ): Promise<any> {
        return this.request<any>("/kukushop-uploads/register-image", {
            method: "POST",
            body: JSON.stringify({ siteId, key, filename, size, contentType }),
        });
    }


    /**
     * Delete a single asset
     * @param id - The asset ID to delete
     * @param s3Key - Optional S3 key if not stored in database
     */
    async deleteAsset(id: string, s3Key?: string): Promise<any> {
        return this.request<any>(`/kukushop-uploads/asset/${id}`, {
            method: "DELETE",
            body: s3Key ? JSON.stringify({ s3Key }) : undefined,
        }, true);
    }
    /**
     * 
     * complete the upload of images if the site is not changed
     */

    async completeImageUpload(clientId: string, siteId: string, photoData: PhotoData[]): Promise<any>{
        return this.request<any>(`/kukushop-uploads/images?clientId=${clientId}`, {
            method: "POST",
            body: JSON.stringify({ siteId, photos:photoData }),
        }, true);
    }

    /**
     * Delete multiple assets in batch
     * @param assetIds - Array of asset IDs to delete
     */
    async batchDeleteAssets(assetIds: string[]): Promise<any> {
        return this.request<any>("/kukushop-uploads/assets/batch-delete", {
            method: "POST",
            body: JSON.stringify({ assetIds }),
        }, true);
    }

    /**
     * @deprecated - Use getSocketUrl() instead
     * Get WebSocket URL with authentication
     */
    async getWebSocketUrl(clientId: string): Promise<string> {
        console.warn("getWebSocketUrl is deprecated. Use getSocketUrl() instead.");
        const token = await getToken()

        const wsUrl = new URL(this.baseURL);
        wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
        wsUrl.pathname = "/complete-upload";
        wsUrl.searchParams.set("clientId", clientId);

        if (token) {
            wsUrl.searchParams.set("token", token);
        }

        return wsUrl.toString();
    }
}

export const uploadApiClient = new UploadApiClient();