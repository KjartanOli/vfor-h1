import { getDatabase } from "./db.js";

import fs from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';


import { logger } from './logger.js';
import { readDir, readFile, stat } from './fs-helper.js';

import { listImages, uploadImage } from './cloudinary.js';

const IMG_DIR = './../../data/img';

const path = dirname(fileURLToPath(import.meta.url));
const imageCloudinaryUrl = new Map();



export async function setup() {
        await getDatabase()?.createSchema();
        console.log('Schema created');

        console.log('Setup complete');

        return true;
}

setup().catch((err) => {
        console.error('error running setup', err);
        process.exit(1);
});


async function images() {
    const imagesOnDisk = await readDir(join(path, IMG_DIR));
    const filteredImages = imagesOnDisk
      .filter((i) => extname(i).toLowerCase() === '.jpg');
  
    if (filteredImages.length === 0) {
      logger.warn('No images to upload');
      return;
    }
  
    const cloudinaryImages = await listImages();
    logger.info(`${cloudinaryImages.length} images in Cloudinary`);
  
    for (const image of filteredImages) {
      let cloudinaryUrl = '';
      const imgPath = join(path, IMG_DIR, image);
      const imgSize = (await stat(imgPath))?.size;
      const uploaded = cloudinaryImages.find((i) => i.bytes === imgSize);
  
      if (uploaded) {
        cloudinaryUrl = uploaded.secure_url;
        logger.info(`${imgPath} already uploaded to Cloudinary`);
      } else {
        const upload = await uploadImage(imgPath);
        if (!upload) {
          logger.warn(`Failed to upload ${imgPath}`);
          continue;
        }
        cloudinaryUrl = upload.secure_url;
        logger.info(`${imgPath} uploaded to Cloudinary`);
      }
  
      imageCloudinaryUrl.set(image, cloudinaryUrl);
    }
  }

setup().catch((err) => {
    console.error('error running setup', err);
    process.exit(1);
});