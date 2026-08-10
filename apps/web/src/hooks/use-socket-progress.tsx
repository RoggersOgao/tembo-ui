// hooks/useSocketProgress.ts

import { getAccessTokenClient } from "@/lib/auth-helpers-client";
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface ProgressEvent {
    step: string;
    message: string;
    percent?: number;
    file?: string;
    filename?: string;
    total?: number;
    timestamp?: string;
    site?: any;
    deletedSiteId?: string;
}

interface UseSocketProgressOptions {
    onProgress?: (event: ProgressEvent) => void;
    onComplete?: (data: any) => void;
    onError?: (error: string) => void;
    autoConnect?: boolean; // Auto-connect on mount
}

interface UseSocketProgressReturn {
    clientId: string;
    isConnected: boolean;
    lastProgress: ProgressEvent | null;
    connect: () => Promise<void>;
    disconnect: () => void;
}

/**
 * Hook to connect to Socket.IO and listen for progress updates
 * 
 * @example
 * const { clientId, isConnected, lastProgress, connect, disconnect } = useSocketProgress({
 *   onProgress: (event) => {
 *     console.log('Progress:', event.message);
 *   },
 *   onComplete: (data) => {
 *     console.log('Complete!', data);
 *   },
 *   onError: (error) => {
 *     console.error('Error:', error);
 *   },
 *   autoConnect: false // Set to true to connect on mount
 * });
 * 
 * // Manually connect when needed
 * await connect();
 */
export function useSocketProgress(
    options: UseSocketProgressOptions = {}
): UseSocketProgressReturn {
    const { onProgress, onComplete, onError, autoConnect = false } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [lastProgress, setLastProgress] = useState<ProgressEvent | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const clientIdRef = useRef<string>(
        `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );

    // Stable callback refs to avoid recreating socket listeners
    const onProgressRef = useRef(onProgress);
    const onCompleteRef = useRef(onComplete);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onProgressRef.current = onProgress;
        onCompleteRef.current = onComplete;
        onErrorRef.current = onError;
    }, [onProgress, onComplete, onError]);

    const connect = useCallback(async (): Promise<void> => {
        // Don't reconnect if already connected
        if (socketRef.current?.connected) {
            console.log("[Socket] Already connected");
            return;
        }

        // Disconnect old socket if exists
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
        }

        try {
            // Get authentication token
            const token = await getAccessTokenClient();

            const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ||
                process.env.NEXT_PUBLIC_API_BASE_URL ||
                "http://localhost:3001";

            console.log("[Socket] Connecting to:", socketUrl);

            const socket = io(socketUrl, {
                transports: ["websocket", "polling"],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5,
                auth: {
                    token: token || undefined
                }
            });

            socketRef.current = socket;

            return new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Connection timeout"));
                }, 10000); // 10 second timeout

                socket.on("connect", () => {
                    clearTimeout(timeout);
                    console.log("[Socket] Connected:", socket.id);
                    setIsConnected(true);

                    // Subscribe to our specific client channel
                    socket.emit("subscribe", clientIdRef.current);
                    console.log("[Socket] Subscribed to channel:", clientIdRef.current);

                    resolve();
                });

                socket.on("disconnect", (reason) => {
                    console.log("[Socket] Disconnected:", reason);
                    setIsConnected(false);
                });

                socket.on("progress", (data: ProgressEvent) => {
                    console.log("[Socket] Progress update:", data);
                    setLastProgress(data);

                    // Call callbacks based on step
                    if (data.step === "done" && onCompleteRef.current) {
                        onCompleteRef.current(data);
                    } else if (data.step === "error" && onErrorRef.current) {
                        onErrorRef.current(data.message);
                    } else if (onProgressRef.current) {
                        onProgressRef.current(data);
                    }
                });

                socket.on("connect_error", (error) => {
                    clearTimeout(timeout);
                    console.error("[Socket] Connection error:", error);
                    setIsConnected(false);

                    if (onErrorRef.current) {
                        onErrorRef.current("Failed to connect to server");
                    }

                    reject(error);
                });

                socket.on("error", (error) => {
                    console.error("[Socket] Error:", error);
                    if (onErrorRef.current) {
                        onErrorRef.current(
                            typeof error === "string" ? error : "Socket error occurred"
                        );
                    }
                });
            });
        } catch (error) {
            console.error("[Socket] Failed to connect:", error);
            if (onErrorRef.current) {
                onErrorRef.current(
                    error instanceof Error ? error.message : "Failed to initialize socket"
                );
            }
            throw error;
        }
    }, []);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            console.log("[Socket] Disconnecting...");
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
            socketRef.current = null;
            setIsConnected(false);
            setLastProgress(null);
        }
    }, []);

    // Auto-connect on mount if enabled
    useEffect(() => {
        if (autoConnect) {
            connect().catch(console.error);
        }

        // Cleanup on unmount
        return () => {
            disconnect();
        };
    }, [autoConnect, connect, disconnect]);

    return {
        clientId: clientIdRef.current,
        isConnected,
        lastProgress,
        connect,
        disconnect
    };
}

/**
 * Alternative: Hook that provides manual control with progress history
 */
interface UseSocketProgressManualReturn {
    clientId: string;
    isConnected: boolean;
    progress: ProgressEvent[];
    lastProgress: ProgressEvent | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    clearProgress: () => void;
}

export function useSocketProgressManual(): UseSocketProgressManualReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [progress, setProgress] = useState<ProgressEvent[]>([]);
    const socketRef = useRef<Socket | null>(null);
    const clientIdRef = useRef<string>(
        `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );

    const connect = useCallback(async (): Promise<void> => {
        if (socketRef.current?.connected) {
            console.log("[Socket] Already connected");
            return;
        }

        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
        }

        try {
            const token = await getAccessTokenClient();
            const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ||
                process.env.NEXT_PUBLIC_API_BASE_URL ||
                "http://localhost:3001";

            const socket = io(socketUrl, {
                transports: ["websocket", "polling"],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5,
                auth: {
                    token: token || undefined
                }
            });

            socketRef.current = socket;

            return new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Connection timeout"));
                }, 10000);

                socket.on("connect", () => {
                    clearTimeout(timeout);
                    console.log("[Socket] Connected");
                    setIsConnected(true);
                    socket.emit("subscribe", clientIdRef.current);
                    resolve();
                });

                socket.on("disconnect", () => {
                    console.log("[Socket] Disconnected");
                    setIsConnected(false);
                });

                socket.on("progress", (data: ProgressEvent) => {
                    setProgress(prev => [...prev, data]);
                });

                socket.on("connect_error", (error) => {
                    clearTimeout(timeout);
                    console.error("[Socket] Connection error:", error);
                    reject(error);
                });
            });
        } catch (error) {
            console.error("[Socket] Failed to connect:", error);
            throw error;
        }
    }, []);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.removeAllListeners();
            socketRef.current.disconnect();
            socketRef.current = null;
            setIsConnected(false);
        }
    }, []);

    const clearProgress = useCallback(() => {
        setProgress([]);
    }, []);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        clientId: clientIdRef.current,
        isConnected,
        progress,
        lastProgress: progress[progress.length - 1] || null,
        connect,
        disconnect,
        clearProgress
    };
}