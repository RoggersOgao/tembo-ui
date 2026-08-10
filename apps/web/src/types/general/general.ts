import { z } from "zod";
import { ReactNode } from "react";

// ─── Location ─────────────────────────────────────────────────────────────────

export interface LocationState {
    latitude: number;
    longitude: number;
    address: string;
}

// ─── Images ───────────────────────────────────────────────────────────────────

/**
 * Serialisable subset — safe to pass to the server / store in form state.
 * No File objects or blob URLs.
 */
export interface ProductImageFormValue {
    id: string;
    name: string;
    size: number;
    type: string;
    width: number;
    height: number;
}

/**
 * Full in-memory representation used in the UI.
 * Extends the form value so it's always a strict superset.
 * `url` is always a blob URL (URL.createObjectURL) — regenerated on restore.
 * `previewUrl` is optional and must be revoked on reset via URL.revokeObjectURL.
 */
export interface ProductImageProps extends ProductImageFormValue {
    url: string;
    file: File | null;
    previewUrl?: string;
}

/** Discriminated new-upload variant — use this when source tracking is needed. */
export interface NewImage extends ProductImageProps {
    source: "new";
}

/** Image already saved in DB/S3 — no File object or dimensions required. */
export interface ExistingImage {
    id: string;
    name: string;
    size: number;
    type: string;
    url: string;
    source: "existing";
}

/** Union for components that handle both new uploads and saved images. */
export type ImageData = NewImage | ExistingImage;

/** State for the image editor panel. */
export interface EditingImageState {
    index: number;
    data: ProductImageProps | undefined;
}

// ─── Type Guards ──────────────────────────────────────────────────────────────

export const isNewImage = (img: ImageData): img is NewImage => img.source === "new";
export const isExistingImage = (img: ImageData): img is ExistingImage => img.source === "existing";

// ─── Image Array Helpers ──────────────────────────────────────────────────────

export const getNewImages = (imgs: ImageData[]): NewImage[] => imgs.filter(isNewImage);
export const getExistingImages = (imgs: ImageData[]): ExistingImage[] => imgs.filter(isExistingImage);
export const countNewImages = (imgs: ImageData[]): number => imgs.filter(isNewImage).length;
export const countExistingImages = (imgs: ImageData[]): number => imgs.filter(isExistingImage).length;

export function hasImagesChanged(current: ImageData[], initial: ImageData[]): boolean {
    if (current.length !== initial.length) return true;
    if (current.some(isNewImage)) return true;
    return current.map(i => i.id).join(",") !== initial.map(i => i.id).join(",");
}

// ─── Image Utilities ──────────────────────────────────────────────────────────

export function prepareImageForUpload(image: NewImage) {
    return {
        file: image.file,
        metadata: {
            id: image.id,
            name: image.name,
            size: image.size,
            type: image.type,
            width: image.width,
            height: image.height,
        },
    };
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
    const MAX_SIZE = 10 * 1024 * 1024;
    const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!ALLOWED_TYPES.includes(file.type))
        return { valid: false, error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP` };

    if (file.size > MAX_SIZE)
        return { valid: false, error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: 10MB` };

    return { valid: true };
}

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function generateImageId(): string {
    return Math.random().toString(36).substring(2, 11);
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export type UploadStep = "idle" | "zip" | "images" | "processing" | "saving";

export const uploadSchema = z.object({
    file: z
        .instanceof(File, { message: "A file is required" })
        .refine(
            (file) => file.name.endsWith(".zip") || file.type.includes("zip"),
            { message: "Only .zip files are allowed" }
        )
        .refine(
            (file) => file.size <= 50 * 1024 * 1024,
            { message: "File size must be less than 50MB" }
        ),
});

export type UploadFormValues = z.infer<typeof uploadSchema>;

// ─── Pricing ──────────────────────────────────────────────────────────────────

export interface SeasonalRate {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    rate: number;
    enabled: boolean;
}

export interface SpecialOffer {
    id: string;
    name: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    conditions?: Record<string, unknown>;
}

export interface PricingConfig {
    baseRate: number;
    currency: string;
    seasonalRates?: SeasonalRate[];
    specialOffers?: SpecialOffer[];
    minimumStay?: number;
    maximumStay?: number;
    cleaningFee?: number;
    securityDeposit?: number;
    taxRate?: number;
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export interface MpesaPaymentConfig {
    phoneNumber: string;
    amount: number;
    transactionId?: string;
    status: "pending" | "processing" | "completed" | "failed";
    timestamp?: string;
}

// ─── File Tree ────────────────────────────────────────────────────────────────

export interface FileNode {
    id: string;
    name: string;
    type: "file" | "folder";
    children?: FileNode[];
    size?: number;
    lastModified?: Date;
}

// ─── Form Steps ───────────────────────────────────────────────────────────────

export interface FormStepNode {
    id: string;
    title: string;
    subtitle?: string;
    description?: string;
    icon?: ReactNode;
    component: ReactNode;
    completedIcon?: ReactNode;
    color?: string;
    validation?: (data: unknown) => boolean | Promise<boolean>;
}