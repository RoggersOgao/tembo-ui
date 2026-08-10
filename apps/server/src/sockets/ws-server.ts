// services/socket.service.ts

import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { logger } from '@repo/logger';

let io: SocketIOServer | null = null;

interface ProgressData {
    step: string;
    message: string;
    percent?: number;
    filename?: string;
    total?: number;
    site?: any;
    deletedSiteId?: string;
    [key: string]: any;
}

/**
 * Initialize Socket.IO server
 * Call this once when your HTTP server starts
 */
export function initializeSocket(httpServer: HTTPServer): SocketIOServer {
    if (io) {
        logger.info("[Socket.IO] Already initialized");
        return io;
    }

    io = new SocketIOServer(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true
        },
        // Add ping/pong for connection health
        pingInterval: 25000,
        pingTimeout: 60000,
        // Allow larger payloads if needed
        maxHttpBufferSize: 1e8 // 100 MB
    });

    // Middleware for authentication (optional but recommended)
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;

            if (!token) {
                logger.info(`[Socket.IO] Client ${socket.id} connecting without token`);
                // Allow connection but log it
                return next();
            }

            // Verify JWT token if provided
            const secret = process.env.JWT_SECRET || "your-secret-key";
            const { verify } = jwt;
            const decoded = verify(token, secret);

            // Attach user info to socket
            socket.data.user = decoded;
            logger.info(`[Socket.IO] Authenticated client ${socket.id}`);

            next();
        } catch (error) {
            console.error(`[Socket.IO] Authentication error:`, error);
            // Still allow connection but without user data
            next();
        }
    });

    io.on("connection", (socket) => {
        logger.info(`[Socket.IO] Client connected: ${socket.id}`);

        if (socket.data.user) {
            logger.info(`[Socket.IO] User: ${socket.data.user.userId || socket.data.user.id}`);
        }

        // Client subscribes to their specific clientId channel
        socket.on("subscribe", (clientId: string) => {
            if (!clientId || typeof clientId !== "string") {
                console.error(`[Socket.IO] Invalid clientId from ${socket.id}`);
                return;
            }

            socket.join(clientId);
            logger.info(`[Socket.IO] Socket ${socket.id} subscribed to client: ${clientId}`);

            // Acknowledge subscription
            socket.emit("subscribed", { clientId, socketId: socket.id });
        });

        // Handle unsubscribe
        socket.on("unsubscribe", (clientId: string) => {
            socket.leave(clientId);
            logger.info(`[Socket.IO] Socket ${socket.id} unsubscribed from client: ${clientId}`);
        });

        // Handle disconnect
        socket.on("disconnect", (reason) => {
            logger.info(`[Socket.IO] Client disconnected: ${socket.id}, reason: ${reason}`);
        });

        // Handle errors
        socket.on("error", (error) => {
            console.error(`[Socket.IO] Socket error for ${socket.id}:`, error);
        });

        // Optional: Handle ping-pong for connection health
        socket.on("ping", () => {
            socket.emit("pong");
        });
    });

    logger.info("[Socket.IO] Server initialized successfully");
    return io;
}

/**
 * Get the Socket.IO instance
 */
export function getIO(): SocketIOServer {
    if (!io) {
        throw new Error("Socket.IO not initialized. Call initializeSocket first.");
    }
    return io;
}

/**
 * Check if Socket.IO is initialized
 */
export function isInitialized(): boolean {
    return io !== null;
}

/**
 * Broadcast progress update to a specific client
 */
export function broadcastProgress(clientId: string, data: ProgressData): void {
    try {
        if (!clientId) {
            console.error("[Socket.IO] Cannot broadcast: clientId is required");
            return;
        }

        const socketIO = getIO();

        // Add timestamp to all progress messages
        const message: ProgressData = {
            ...data,
            timestamp: new Date().toISOString(),
            clientId
        };

        // Emit to the specific client room
        socketIO.to(clientId).emit("progress", message);

        logger.info(`[Socket.IO] Broadcasted to ${clientId}:`, {
            step: data.step,
            message: data.message,
            percent: data.percent
        });
    } catch (error) {
        console.error("[Socket.IO] Error broadcasting progress:", error);
        // Don't throw - just log the error to prevent breaking the main operation
    }
}

/**
 * Broadcast to multiple clients
 */
export function broadcastToClients(clientIds: string[], data: ProgressData): void {
    try {
        const socketIO = getIO();

        const message: ProgressData = {
            ...data,
            timestamp: new Date().toISOString()
        };

        clientIds.forEach(clientId => {
            if (clientId) {
                socketIO.to(clientId).emit("progress", message);
            }
        });

        logger.info(`[Socket.IO] Broadcasted to ${clientIds.length} clients`);
    } catch (error) {
        console.error("[Socket.IO] Error broadcasting to clients:", error);
    }
}

/**
 * Broadcast to all connected clients (use sparingly)
 */
export function broadcastToAll(event: string, data: any): void {
    try {
        const socketIO = getIO();

        socketIO.emit(event, {
            ...data,
            timestamp: new Date().toISOString()
        });

        logger.info(`[Socket.IO] Broadcasted to all clients: ${event}`);
    } catch (error) {
        console.error("[Socket.IO] Error broadcasting to all:", error);
    }
}

/**
 * Get number of connected clients
 */
export async function getConnectedCount(): Promise<number> {
    try {
        const socketIO = getIO();
        const sockets = await socketIO.fetchSockets();
        return sockets.length;
    } catch (error) {
        console.error("[Socket.IO] Error getting connected count:", error);
        return 0;
    }
}

/**
 * Get clients in a specific room
 */
export async function getClientsInRoom(room: string): Promise<string[]> {
    try {
        const socketIO = getIO();
        const sockets = await socketIO.in(room).fetchSockets();
        return sockets.map(socket => socket.id);
    } catch (error) {
        console.error(`[Socket.IO] Error getting clients in room ${room}:`, error);
        return [];
    }
}

/**
 * Disconnect a specific client
 */
export async function disconnectClient(socketId: string): Promise<void> {
    try {
        const socketIO = getIO();
        const socket = socketIO.sockets.sockets.get(socketId);

        if (socket) {
            socket.disconnect(true);
            logger.info(`[Socket.IO] Disconnected client: ${socketId}`);
        } else {
            logger.info(`[Socket.IO] Client ${socketId} not found`);
        }
    } catch (error) {
        console.error(`[Socket.IO] Error disconnecting client ${socketId}:`, error);
    }
}

/**
 * Gracefully close Socket.IO server
 */
export async function closeSocket(): Promise<void> {
    if (io) {
        logger.info("[Socket.IO] Closing server...");
        await io.close();
        io = null;
        logger.info("[Socket.IO] Server closed");
    }
}
