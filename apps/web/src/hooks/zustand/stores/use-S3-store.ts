"use client";

import { create } from "zustand";
import { uploadApiClient } from "@/lib/upload-api";
import { io, Socket } from "socket.io-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhotoData {
  key:    string;
  name:   string;
  size:   number;
  type:   string;
  width:  number;
  height: number;
}

interface ProgressPayload {
  step:     ProcessingStep;
  message?: string;
  percent?: number;
}

export type ProcessingStep =
  | "start"
  | "link_assets"
  | "retrying"
  | "done"
  | "error"
  | "asset_created"
  | "delete_start"
  | "listing_objects"
  | "deleting_s3"
  | "deleting_assets"
  | "deleting_site"
  | "download"
  | "extract"
  | "upload"
  | "upload_file"
  | "entry"
  | "assets"
  | null;

export interface ProcessingState {
  step: ProcessingStep;
  message: string;
  fileProgress: number;
  percent?: number;
  currentFilename?: string;
}

interface State {
  loading:         boolean;
  progress:        number;
  processingState: ProcessingState;
  error?:          string;
  socket:          Socket | null;
  clientId:        string | null;

  // Socket
  initSocket:       () => Promise<Socket>;
  disconnectSocket: () => void;

  // Image
  presignImage:             (productId: string, file: File) => Promise<{ uploadUrl: string; key: string }>;
  uploadImageToPresigned:   (file: File, url: string) => Promise<void>;
  registerImage:            (productId: string, key: string, filename: string, size: number, contentType?: string) => Promise<any>;
  completeImageAssetUpload: (productId: string, photoData?: PhotoData[]) => Promise<any>;

  // Asset
  batchDeleteAssets: (assetIds: string[]) => Promise<void>;

  resetStore: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateClientId = () =>
  `client-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

const INITIAL_PROCESSING: ProcessingState = {
  step:         null,
  message:      "",
  fileProgress: 0,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useS3Store = create<State>((set, get) => ({
  loading:         false,
  progress:        0,
  processingState: INITIAL_PROCESSING,
  error:           undefined,
  socket:          null,
  clientId:        null,

  // ── Socket ──────────────────────────────────────────────────────────────

  initSocket: async () => {
    const state = get();

    if (state.socket?.connected) return state.socket;
    if (state.socket) state.socket.disconnect();

    const clientId  = generateClientId();
    const socketUrl = await uploadApiClient.getSocketUrl();

    const socket = io(socketUrl, {
      transports:           ["websocket", "polling"],
      reconnection:         true,
      reconnectionDelay:    1_000,
      reconnectionAttempts: 10,
      reconnectionDelayMax: 10_000,
      auth: async (cb) => {
        const token = await uploadApiClient.getAuthToken();
        cb({ token });
      },
    });

    return new Promise((resolve, reject) => {
      socket.on("connect", () => {
        console.log("[Socket] Connected:", socket.id);
        socket.emit("subscribe", clientId);
        set({ socket, clientId });
        resolve(socket);
      });

      socket.on("connect_error", (error) => {
        console.error("[Socket] Connection error:", error);
        set({ error: "Failed to connect to server" });
        reject(error);
      });
    });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, clientId: null });
    }
  },

  resetStore: () => {
    get().socket?.disconnect();
    set({
      loading:         false,
      progress:        0,
      processingState: INITIAL_PROCESSING,
      error:           undefined,
      socket:          null,
      clientId:        null,
    });
  },

  // ── Image ────────────────────────────────────────────────────────────────

  presignImage: async (sku, file) => {
    try {
      set({ error: undefined });
      return await uploadApiClient.presignImage(sku, file.name, file.type);
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  uploadImageToPresigned: (file, url) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      set({ loading: true, progress: 0, error: undefined });

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          set({ progress: Math.round((e.loaded / e.total) * 100) });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          set({ loading: false, progress: 100 });
          resolve();
        } else {
          set({ loading: false, error: "Image upload failed" });
          reject(new Error(`Image upload failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        set({ loading: false, error: "Image upload failed" });
        reject(new Error("Image upload failed"));
      };

      xhr.send(file);
    }),

  registerImage: async (productId, key, filename, size, contentType) => {
    try {
      set({ error: undefined });
      return await uploadApiClient.registerImage(productId, key, filename, size, contentType);
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  // ── Complete Image Asset Upload ──────────────────────────────────────────
  // Calls the backend to register all uploaded S3 images as Asset DB records.
  // Uses socket for progress feedback (server broadcasts link_assets → done).

  completeImageAssetUpload: async (productId, photoData = []) => {
    try {
      let { socket, clientId } = get();
      if (!socket?.connected || !clientId) {
        await get().initSocket();
        ({ socket, clientId } = get());
      }
      if (!socket || !clientId) throw new Error("Socket connection failed");

      set({
        loading: true,
        error:   undefined,
        processingState: {
          step:         "start",
          message:      "Registering images…",
          fileProgress: 0,
        },
      });

      // Listen for progress from server before firing the request
      const progressHandler = (data: ProgressPayload) => {
        if (data.step === "link_assets") {
          set({
            processingState: {
              step:         "link_assets",
              message:      data.message ?? "Linking asset records…",
              fileProgress: data.percent ?? 50,
              percent:      data.percent,
            },
          });
        }
      };
      socket.on("progress", progressHandler);

      const result = await uploadApiClient.completeImageUpload(clientId, productId, photoData);

      socket.off("progress", progressHandler);

      set({
        loading:         false,
        processingState: {
          step:         "done",
          message:      "Images registered successfully",
          fileProgress: 100,
          percent:      100,
        },
      });

      return result;
    } catch (error: any) {
      set({
        loading: false,
        error:   error.message,
        processingState: {
          step:         "error",
          message:      `Failed to register images: ${error.message}`,
          fileProgress: 0,
        },
      });
      throw error;
    }
  },

  // ── Asset ─────────────────────────────────────────────────────────────────

  batchDeleteAssets: async (assetIds) => {
    try {
      set({ loading: true, error: undefined });
      await uploadApiClient.batchDeleteAssets(assetIds);
      set({ loading: false });
    } catch (error: any) {
      set({ loading: false, error: error.message });
      throw error;
    }
  },
}));