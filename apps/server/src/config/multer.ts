import multer from "multer";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { Request } from "express";

const storage = multer.memoryStorage();

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4024 * 1024 * 1024 } // 10MB
});

export const processImages = async (files: Express.Multer.File[]) => {
  return Promise.all(
    files.map(async (file) => {
      const filename = `property-${uuidv4()}-${Date.now()}.webp`;
      
      await sharp(file.buffer)
        .resize(1200, 800, { fit: "cover" })
        .webp({ quality: 80 })
        .toFile(`public/images/${filename}`);

      return `${process.env.API_URL}/images/${filename}`;
    })
  );
};