import util from 'util';

import { v2 as cloudinary, UploadApiResponse, ResourceApiResponse } from 'cloudinary';
import dotenv from 'dotenv';


dotenv.config();

const resourcesAsync = util.promisify(cloudinary.api.resources);
const uploadAsync = util.promisify(cloudinary.uploader.upload);

const CLOUDINARY_MAX_RESULTS = 100;

let cachedListImages: ResourceApiResponse['resources'] | null = null;

export async function listImages(): Promise<ResourceApiResponse['resources']> {
  if (cachedListImages) {
    return Promise.resolve(cachedListImages);
  }

  let nextCursor;
  const resources = [];

do {
    const query: { max_results: number, next_cursor?: string } = { max_results: CLOUDINARY_MAX_RESULTS };

    if (nextCursor) {
        query.next_cursor = nextCursor;
    }

    // eslint-disable-next-line no-await-in-loop
    const res = await resourcesAsync(query);

    nextCursor = res.next_cursor;

    resources.push(...res.resources);
} while (nextCursor);

cachedListImages = resources as ResourceApiResponse['resources'];

return resources as ResourceApiResponse['resources'];
}

export async function uploadImage(filepath: string) {
    return uploadAsync(filepath);
}
