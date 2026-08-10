import { db } from "@repo/database";
import { Response } from "express";
import multer from 'multer';
import { AuthRequest } from "../../middlewares/auth.middleware";
import {
    createPresignedPutUrl,
    deleteMultipleFromS3,
    getSignedUrlForKey,
} from "../../services/s3-upload-service/s3";
import { broadcastProgress } from "../../sockets/ws-server";
import { logger } from '@repo/logger';

// ─── Multer ───────────────────────────────────────────────────────────────────

export const uploadImageMemory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4024 * 1024 * 1024 },
}).single("image");

// ─── POST /uploads/presign-image ──────────────────────────────────────────────
// body: { productId, filename, contentType }
// returns { uploadUrl, key }
// Frontend uploads directly to S3 with PUT, then calls /uploads/images/complete
export async function presignImageUpload(req: AuthRequest, res: Response) {
    try {
        const { sku, filename, contentType } = req.body;

        if (!filename) {
            return res.status(400).json({ error: "filename is required" });
        }

        // No product exists yet — use SKU (or a temp namespace) as the S3 folder
        const namespace = (sku ?? "product").replace(/ /g, "_");
        const key = `products/${namespace}/images/${Date.now()}-${filename}`.replace(/ /g, "_");
        const uploadUrl = await createPresignedPutUrl(key, contentType, 60 * 60);

        return res.json({ ok: true, uploadUrl, key });
    } catch (error) {
        logger.error("presignImageUpload error", { error });
        return res.status(500).json({ error: "Failed to generate presigned URL", details: (error as any).message });
    }
}

// ─── POST /uploads/images/complete ────────────────────────────────────────────
// body: { productId, photos: PhotoData[] }
// Registers already-uploaded S3 images as Asset records for a product
export async function uploadNewImages(req: AuthRequest, res: Response) {
    const clientId = req.query.clientId as string;
    const { productId, photos } = req.body;

    logger.info("uploadNewImages called", { clientId, productId, photoCount: photos?.length });

    if (!clientId) {
        return res.status(400).json({ error: "clientId query param is required" });
    }
    if (!productId) {
        return res.status(400).json({ error: "productId is required" });
    }

    try {
        const product = await db.product.findUnique({ where: { id: productId } });
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        if (!Array.isArray(photos) || photos.length === 0) {
            logger.info("No photos to register");
            return res.status(200).json({
                success: true,
                message: "No images to register",
                assets: [],
                count: 0,
            });
        }

        broadcastProgress(clientId, {
            step: "link_assets",
            message: "Registering image assets…",
        });

        const results = await Promise.all(
            photos.map(async (photo) => {
                const { key, name, size, type } = photo;

                if (!key) {
                    logger.warn(`Skipping photo "${name}": no S3 key`);
                    return null;
                }

                try {
                    const asset = await db.asset.create({
                        data: {
                            productId,
                            filename:    name,
                            s3Key:       key,
                            contentType: type ?? "application/octet-stream",
                            size:        Number(size ?? 0),
                        },
                    });
                    logger.info(`Created asset ${asset.id} — ${asset.filename}`);
                    return asset;
                } catch (err) {
                    logger.error(`Failed to create asset for "${name}"`, { err });
                    return null;
                }
            }),
        );

        const assets   = results.filter(Boolean);
        const skipped  = photos.length - assets.length;

        broadcastProgress(clientId, {
            step:    "done",
            message: `Registered ${assets.length} image(s) successfully`,
        });

        return res.status(200).json({
            success: true,
            message: `Registered ${assets.length} image(s)`,
            assets,
            count:   assets.length,
            skipped,
        });

    } catch (error) {
        logger.error("uploadNewImages error", { error });
        broadcastProgress(clientId, {
            step:    "error",
            message: "Failed to register images in database",
        });
        return res.status(500).json({
            success: false,
            error:   "Failed to register images",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
}

// ─── POST /uploads/register-image ─────────────────────────────────────────────
// body: { productId, key, filename, size, contentType }
// Registers a single image and returns a signed GET URL — useful for immediate preview
export async function registerImage(req: AuthRequest, res: Response) {
    try {
        const { productId, key, filename, size, contentType } = req.body;

        if (!productId || !key) {
            return res.status(400).json({ error: "productId and key are required" });
        }

        const product = await db.product.findUnique({ where: { id: productId } });
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        const asset = await db.asset.create({
            data: {
                productId,
                filename:    filename ?? key.split("/").pop() ?? "image",
                s3Key:       key,
                contentType: contentType ?? "application/octet-stream",
                size:        Number(size ?? 0),
            },
        });

        const signedUrl = await getSignedUrlForKey(key);
        return res.json({ ok: true, asset, signedUrl });

    } catch (error) {
        logger.error("registerImage error", { error });
        return res.status(500).json({ error: "Failed to register image", details: (error as any).message });
    }
}

// ─── POST /uploads/assets/delete-batch ───────────────────────────────────────
// body: { assetIds: string[], clientId? }
// Deletes assets from S3 and the database
export async function deleteBatch(req: AuthRequest, res: Response) {
    try {
        const { assetIds, clientId } = req.body;

        if (!Array.isArray(assetIds) || assetIds.length === 0) {
            return res.status(400).json({ error: "assetIds array is required" });
        }

        const assets = await db.asset.findMany({
            where: { id: { in: assetIds } },
            select: { id: true, s3Key: true, productId: true },
        });

        if (assets.length === 0) {
            return res.status(404).json({ error: "No assets found with provided IDs" });
        }

        // Delete from S3
        const s3Keys = assets.map((a) => a.s3Key);
        await deleteMultipleFromS3(s3Keys, clientId);

        // Delete from DB
        const deleted = await db.asset.deleteMany({
            where: { id: { in: assets.map((a) => a.id) } },
        });

        if (clientId) {
            broadcastProgress(clientId, {
                step:    "done",
                message: `Deleted ${deleted.count} asset(s)`,
                percent: 100,
            });
        }

        return res.json({
            ok:           true,
            message:      `Deleted ${deleted.count} asset(s)`,
            deletedCount: deleted.count,
            deletedIds:   assets.map((a) => a.id),
        });

    } catch (error) {
        logger.error("deleteBatch error", { error });
        return res.status(500).json({ error: "Failed to delete assets", details: (error as any).message });
    }
}