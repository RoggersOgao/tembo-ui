import fs from "fs"
import path from "path"
import unzipper from "unzipper";
import mime from "mime-types"
import { uploadFileToS3 } from "../services/s3-upload-service/s3";
import pLimit from 'p-limit';

interface ExtractProgress {
  fileName: string;
  percent: number;
  extracted: number;
  total: number;
}
// extract the zip file to a certain directory
export async function extractZip(
  zipPath: string,
  destDir: string,
  onProgress?: (data: ExtractProgress) => void
) {
  await fs.promises.mkdir(destDir, { recursive: true });

  // First pass: count files
  const directory = await unzipper.Open.file(zipPath);
  const entries = directory.files.filter(f => !f.path.endsWith("/")); // ignore folders
  const total = entries.length;
  let extracted = 0;

  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Parse())
      .on("entry", async (entry: any) => {
        const filePath = path.join(destDir, entry.path);

        if (entry.type === "Directory") {
          // ensure folder exists
          await fs.promises.mkdir(filePath, { recursive: true });
          entry.autodrain();
          return;
        }

        // ensure folder exists
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

        entry.pipe(fs.createWriteStream(filePath)).on("finish", () => {
          extracted++;

          if (onProgress) {
            onProgress({
              fileName: entry.path,
              percent: Math.round((extracted / total) * 100),
              extracted,
              total
            });
          }
        });
      })
      .on("close", resolve)
      .on("error", reject);
  });
}

/** 
 * upload all the files inside folder root to s3 under prefix recursively
 * upload single files
 * upload a directory
*/




// Set a safe maximum number of parallel uploads (e.g., 15)
const limit = pLimit(15);

export async function uploadDirectoryRecursive(
  localRoot: string,
  s3Prefix: string,
  progressCallback?: (filename: string, percent: number) => void
) {
  const entries = await fs.promises.readdir(localRoot, { withFileTypes: true });
  const uploadTasks: Promise<void>[] = [];

  for (const entry of entries) {
    const fullPath = path.join(localRoot, entry.name);
    const key = `${s3Prefix}/${entry.name}`;

    if (entry.isDirectory()) {
      // Recursively call, which creates more tasks
      uploadTasks.push(uploadDirectoryRecursive(fullPath, key, progressCallback));
    } else if (entry.isFile()) {
      const contentType = mime.lookup(fullPath) || "application/octet-stream";

      // Wrap the async operation in the limit function
      // This function will only be executed when one of the 15 slots is free.
      const uploadTask = limit(async () => {
        await uploadFileToS3(fullPath, key, contentType, (percent) => {
          if (progressCallback) {
            progressCallback(fullPath, percent);
          }
        });
      });
      uploadTasks.push(uploadTask);
    }
  }

  // Wait for all current and future tasks triggered by this recursion level
  await Promise.all(uploadTasks);
}

/**
 * 
 * @param dir 
 * @returns find index.html if folder recursively
 */
export async function findIndexHtml(localRoot: string): Promise<string | null> {
  const items = await fs.promises.readdir(localRoot, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(localRoot, item.name);
    if (item.isFile() && item.name.toLowerCase() === "index.htm") {
      return path.relative(localRoot, full).replace(/\\/g, "/");
    }
    if (item.isDirectory()) {
      const found = await findIndexHtml(full);
      if (found) return path.join(item.name, found).replace(/\\/g, "/");
    }
  }
  return null;
}
