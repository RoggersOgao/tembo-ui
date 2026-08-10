import {
    _Object,
    DeleteObjectsCommand,
    DeleteObjectsCommandInput,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    ListObjectsV2CommandOutput,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { Progress, Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as fs from "fs";
import path from "path";
import { ENV } from "../../config/config";
import { broadcastProgress } from "../../sockets/ws-server";
import pLimit from "p-limit";
import { buildProgress } from "../../utils/download-utils";
import {logger} from '@repo/logger';


// --- Environment Variable Validation and Configuration ---

// Use constants for configuration and validate required environment variables
const REGION = ENV.AWS_REGION;
const BUCKET = ENV.AWS_BUCKET;
const ACCESS_KEY_ID = ENV.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = ENV.AWS_SECRET_ACCESS_KEY;
// Parse the expiry seconds, defaulting to 1 hour (3600 seconds)
const SIGNED_URL_EXPIRY_SECONDS = Number(ENV.SIGNED_URL_EXPIRY_SECONDS ?? 3600);

if (!REGION || !BUCKET || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error(
        "Missing one or more required environment variables: AWS_REGION, AWS_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY. Please check your .env file or deployment environment."
    );
}

// --- S3 Client Initialization (Fix for Redeclaration Error) ---

// Fix: Define and export the client in one statement to avoid 'Cannot redeclare exported variable s3'
export const s3 = new S3Client({
    region: REGION,
    credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
    },
});

// --- Utility Functions ---

/**
 * Uploads a local file to S3. Includes critical stream error handling.
 * @param localFilePath The local path to the file.
 * @param key The destination key (path) in the S3 bucket.
 * @param contentType The MIME type of the file.
 */

// upload a local file to s3 (uses lib-storage for large files)
export async function uploadFileToS3(
    localPath: string,
    key: string,
    contentType?: string,
    progressCallback?: (percent: number) => void
) {
    const fileStream = fs.createReadStream(localPath);

    fileStream.on("error", (err) => {
        console.error(`File stream error for ${localPath}:`, err);
        // Throwing here will stop the upload promise chain
        // A simple console error often suffices as the upload.done() will also fail.
    });

    const parallelUpload = new Upload({
        client: s3,
        params: {
            Bucket: BUCKET,
            Key: key,
            Body: fileStream,
            ContentType: contentType,
        },
    });

    if (progressCallback) {
        parallelUpload.on("httpUploadProgress", (progress: Progress) => {
            if (progress.loaded !== undefined && progress.total !== undefined && progress.total > 0) {
                const percent = (progress.loaded / progress.total) * 100;
                progressCallback(percent);
            }
        });
    }

    try {
        // Wait for the upload to finish
        await parallelUpload.done();
    } catch (error) {
        // Re-throw the error so it bubbles up to the recursive function
        throw error;
    } finally {
        // This runs regardless of success or failure
        fileStream.close();
    }
}

// download object from s3 to a local file (stream)
/* export async function downloadObjectToFile(key: string, destPath: string) {
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const res = await s3.send(cmd);
    const body = res.Body as any;
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    const stream = body.pipe(fs.createWriteStream(destPath));
    return new Promise<void>((resolve, reject) => {
        stream.on("finish", () => resolve());
        stream.on("error", reject);
    });
} */


const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_CONCURRENT_DOWNLOADS = 10;

export async function downloadObjectToFile(
    clientId: string,
    key: string,
    destPath: string
) {
    // --- 1. Get metadata ---
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    const fileSize = head.ContentLength!;

    // --- 2. Prepare destination ---
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    const fileHandle = await fs.promises.open(destPath, "w");

    // --- 3. Setup chunks ---
    const numChunks = Math.ceil(fileSize / CHUNK_SIZE);
    let downloaded = 0;

    broadcastProgress(clientId, {
        step: "download",
        message: `Preparing download (${numChunks} parts)`,
        progress: 0,
        percent: 0
    });

    const limit = pLimit(MAX_CONCURRENT_DOWNLOADS);

    // --- 4. Create tasks ---
    const tasks = Array.from({ length: numChunks }, (_, i) =>
        limit(async () => {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE - 1, fileSize - 1);

            const res = await s3.send(new GetObjectCommand({
                Bucket: BUCKET,
                Key: key,
                Range: `bytes=${start}-${end}`
            }));

            const buffer = Buffer.from(await res.Body!.transformToByteArray());

            // Write chunk at position
            await fileHandle.write(buffer, 0, buffer.length, start);

            // Progress update
            downloaded += buffer.length;
            const percent = buildProgress(downloaded, fileSize);

            broadcastProgress(clientId, {
                step: "download",
                message: `Downloading part ${i + 1}/${numChunks}`,
                progress: percent,
                percent
            });
        })
    );

    // --- 5. Wait for all chunks ---
    await Promise.all(tasks);
    await fileHandle.close();

    // --- 6. Final 100% broadcast ---
    broadcastProgress(clientId, {
        step: "download",
        message: "Download complete!",
        progress: 100,
        percent: 100
    });
}

/**
 * 
 * @param key 
 * @param contentType 
 * @param expiresIn 
 * @returns creates a presigned put url
 */
export async function createPresignedPutUrl(key: string, contentType?: string, expiresIn = 3600) {
    const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
    return getSignedUrl(s3, cmd, { expiresIn });
}

/**
 * Generates a signed URL for a specific object key.
 * @param key The key of the object in S3.
 * @param expiresSeconds The duration in seconds the URL is valid (defaults to env config).
 * @returns A promise that resolves to the signed URL string.
 */
export async function getSignedUrlForKey(key: string, expiresSeconds: number = SIGNED_URL_EXPIRY_SECONDS): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return await getSignedUrl(s3, cmd, { expiresIn: expiresSeconds });
}

/**
 * Lists ALL objects in the bucket that have the specified prefix, implementing pagination
 * for results exceeding 1000 objects.
 * @param prefix The prefix (folder path) to search under.
 * @returns A promise that resolves to an array of S3 object metadata.
 */
export async function listObjectsWithPrefix(prefix: string): Promise<_Object[]> {
    let allContents: _Object[] = [];
    let continuationToken: string | undefined = undefined;

    do {
        const res: ListObjectsV2CommandOutput = await s3.send(
            new ListObjectsV2Command({
                Bucket: BUCKET,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            })
        );

        if (res.Contents) {
            allContents = allContents.concat(res.Contents);
        }

        continuationToken = res.NextContinuationToken;
    } while (continuationToken);

    return allContents;
}


/**
 * Deletes multiple objects from the S3 bucket in chunks of 1000 concurrently.
 * @param keys Array of object keys to delete.
 * @param concurrency Number of chunks to delete in parallel (default: 3).
 */
/**
 * Delete many S3 objects using concurrency + broadcast progress to the client.
 */
export async function deleteObjects(
    keys: string[],
    clientId: string,
    concurrency: number = 3
): Promise<void> {
    if (!keys || keys.length === 0) {
        broadcastProgress(clientId, {
            step: "deleting_s3",
            message: "No objects to delete",
            percent: 60
        });
        return;
    }

    const chunkSize = 1000; // S3 DeleteObjects API limit
    const chunks: string[][] = [];

    // Split keys into chunks of 1000
    for (let i = 0; i < keys.length; i += chunkSize) {
        chunks.push(keys.slice(i, i + chunkSize));
    }

    const totalChunks = chunks.length;
    let completedChunks = 0;

    broadcastProgress(clientId, {
        step: "deleting_s3",
        message: `Deleting ${keys.length} objects from S3...`,
        total: keys.length,
        percent: 30
    });

    // Delete one chunk
    const deleteChunk = async (chunk: string[]) => {
        const objectsToDelete = chunk.map((key) => ({ Key: key }));

        try {
            const result = await s3.send(
                new DeleteObjectsCommand({
                    Bucket: BUCKET,
                    Delete: { Objects: objectsToDelete }
                })
            );

            if (result.Errors?.length) {
                console.warn("[S3] Deletion errors:", result.Errors);
                // Don't throw - continue with other deletions
            }

            if (result.Deleted?.length) {
                logger.info(`[S3] Deleted ${result.Deleted.length} objects`);
            }

        } catch (err) {
            console.error("[S3] Failed to delete chunk:", err);
            // Don't throw - continue with other chunks
        }

        completedChunks++;

        // Progress from 30% to 60% during S3 deletion
        const percent = Math.round(30 + (completedChunks / totalChunks) * 30);

        broadcastProgress(clientId, {
            step: "deleting_s3",
            message: `Deleted ${completedChunks}/${totalChunks} batches (${Math.round((completedChunks / totalChunks) * 100)}%)`,
            percent
        });
    };

    // Execute deletions with concurrency control
    const executing: Promise<void>[] = [];

    for (const chunk of chunks) {
        const promise = deleteChunk(chunk).finally(() => {
            const idx = executing.indexOf(promise);
            if (idx > -1) executing.splice(idx, 1);
        });

        executing.push(promise);

        // Wait if we've hit the concurrency limit
        if (executing.length >= concurrency) {
            await Promise.race(executing);
        }
    }

    // Wait for all remaining deletions to complete
    await Promise.all(executing);

    broadcastProgress(clientId, {
        step: "deleting_s3",
        message: `All S3 objects deleted (${keys.length} total)`,
        percent: 60
    });
}




/**
 * Delete multiple files from S3 concurrently in batches of 1000.
 * @param keys An array of S3 object keys (paths) to delete.
 * @param clientId Client ID for broadcasting progress updates
 * @param concurrency Number of concurrent batch deletions (default: 3)
 */
export async function deleteMultipleFromS3(
    keys: string[],
    clientId?: string,
    concurrency: number = 3
): Promise<void> {
    if (keys.length === 0) {
        logger.info('No keys provided to delete.');
        if (clientId) {
            broadcastProgress(clientId, {
                step: "deleting_s3",
                message: "No objects to delete",
                percent: 60
            });
        }
        return;
    }

    const BATCH_SIZE = 1000; // S3 limit for DeleteObjects is 1000 keys per request
   
    // 1. Create batches of keys
    const batches: string[][] = [];
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
        batches.push(keys.slice(i, i + BATCH_SIZE));
    }

    const totalBatches = batches.length;
    let completedBatches = 0;

    // Initial progress broadcast
    if (clientId) {
        broadcastProgress(clientId, {
            step: "deleting_s3",
            message: `Deleting ${keys.length} objects from S3...`,
            total: keys.length,
            percent: 30
        });
    }

    // 2. Function to delete a single batch
    const deleteBatch = async (batch: string[], batchIndex: number) => {
        const deleteParams: DeleteObjectsCommandInput = {
            Bucket: BUCKET,
            Delete: {
                Objects: batch.map(key => ({ Key: key })),
                Quiet: false
            }
        };

        try {
            const result = await s3.send(new DeleteObjectsCommand(deleteParams));

            if (result.Errors?.length) {
                console.warn(`[S3] Deletion errors in batch ${batchIndex + 1}:`, result.Errors);
                // Don't throw - continue with other deletions
            }

            if (result.Deleted?.length) {
                logger.info(`[S3] Deleted ${result.Deleted.length} objects in batch ${batchIndex + 1}/${totalBatches}`);
            }
        } catch (error) {
            console.error(`[S3] Failed to delete batch ${batchIndex + 1}:`, error);
            // Don't throw - continue with other batches
        }

        completedBatches++;

        // Broadcast progress (30% to 60% during S3 deletion)
        if (clientId) {
            const percent = Math.round(30 + (completedBatches / totalBatches) * 30);
            broadcastProgress(clientId, {
                step: "deleting_s3",
                message: `Deleted ${completedBatches}/${totalBatches} batches (${Math.round((completedBatches / totalBatches) * 100)}%)`,
                percent
            });
        }
    };

    // 3. Execute deletions with concurrency control
    const executing: Promise<void>[] = [];

    for (let i = 0; i < batches.length; i++) {
        const promise = deleteBatch(batches[i], i).finally(() => {
            const idx = executing.indexOf(promise);
            if (idx > -1) executing.splice(idx, 1);
        });

        executing.push(promise);

        // Wait if we've hit the concurrency limit
        if (executing.length >= concurrency) {
            await Promise.race(executing);
        }
    }

    // Wait for all remaining deletions to complete
    await Promise.all(executing);

    // Final progress broadcast
    if (clientId) {
        broadcastProgress(clientId, {
            step: "deleting_s3",
            message: `All S3 objects deleted (${keys.length} total)`,
            percent: 60
        });
    }

    logger.info(`\n All ${keys.length} files successfully deleted from S3.`);
}