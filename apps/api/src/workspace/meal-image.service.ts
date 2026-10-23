import { BadRequestException, Injectable, NotImplementedException, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import sharp from 'sharp';

export const MAX_RAW_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_STORED_IMAGE_BYTES = 2 * 1024 * 1024;

export function imageSignature(buffer: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (buffer.length >= 12 && buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP') return 'webp';
  return null;
}

@Injectable()
export class MealImageService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  get bucket() { return new GridFSBucket(this.connection.db!, { bucketName: 'PrivateMealImages' }); }

  async sanitise(raw: Buffer): Promise<Buffer> {
    if (!raw?.length || raw.length > MAX_RAW_IMAGE_BYTES || !imageSignature(raw)) {
      throw new BadRequestException('Only JPEG, PNG or WebP images up to 5 MB are accepted');
    }
    try {
      const pipeline = sharp(raw, { failOn: 'error', limitInputPixels: 20_000_000 });
      const metadata = await pipeline.metadata();
      if (!metadata.width || !metadata.height || !['jpeg','png','webp'].includes(metadata.format || '')) {
        throw new Error('Invalid image');
      }
      // Re-encode: EXIF/GPS, ICC metadata and original filename never enter storage.
      const clean = await pipeline.rotate().resize(1024,1024,{
        fit:'inside',withoutEnlargement:true,
      }).webp({ quality: 78, effort: 4 }).toBuffer();
      if (clean.length > MAX_STORED_IMAGE_BYTES) throw new Error('Transcoded image exceeds limit');
      return clean;
    } catch {
      throw new BadRequestException('The image could not be safely decoded and normalised');
    }
  }

  async save(image: Buffer, patientId: ObjectId, entryId: ObjectId): Promise<ObjectId> {
    const stream = this.bucket.openUploadStream('meal.webp', {
      contentType: 'image/webp', metadata: { patientId, entryId, createdAt: new Date() },
    });
    await new Promise<void>((resolve, reject) => {
      stream.once('finish', () => resolve());
      stream.once('error', reject);
      stream.end(image);
    });
    return stream.id as ObjectId;
  }

  async remove(imageId?: ObjectId | string | null) {
    if (!imageId || !ObjectId.isValid(imageId)) return;
    try { await this.bucket.delete(new ObjectId(String(imageId))); }
    catch (error) {
      // Files can already have been removed by a previous retry.
      if ((error as { code?: number }).code !== 'ENOENT') throw error;
    }
  }

  async read(imageId: ObjectId | string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of this.bucket.openDownloadStream(new ObjectId(String(imageId)))) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async recognise(image: Buffer): Promise<{ label: string; confidence: number }[]> {
    const configured = process.env.AYU_LOCAL_VISION_URL;
    if (!configured) throw new NotImplementedException('Local food recognition is not yet configured; enter the food manually');
    // A strict loopback policy prevents images being sent to third-party inference services.
    let url: URL;
    try { url = new URL(configured); } catch { throw new ServiceUnavailableException('Invalid local model configuration'); }
    if (url.protocol !== 'http:' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash) {
      throw new ServiceUnavailableException('The recognition service must use a local loopback address');
    }
    try {
      const response = await fetch(url, {
        method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),
        headers:{'content-type':'image/webp','accept':'application/json'},body:new Uint8Array(image),
      });
      if (!response.ok) throw new Error('Unavailable');
      const body = await response.text();
      if (body.length > 16_384) throw new Error('Model response too large');
      const json = JSON.parse(body) as { candidates?: unknown };
      if (!Array.isArray(json.candidates)) throw new Error('Invalid response');
      return json.candidates.slice(0,5).flatMap(item => {
        const candidate = item as { label?: unknown; confidence?: unknown };
        return typeof candidate.label === 'string' && candidate.label.length > 0 && candidate.label.length <= 120 &&
          typeof candidate.confidence === 'number' && Number.isFinite(candidate.confidence) &&
          candidate.confidence >= 0 && candidate.confidence <= 1
          ? [{ label: candidate.label, confidence: candidate.confidence }] : [];
      });
    } catch {
      throw new ServiceUnavailableException('Local food recognition is unavailable; enter the food manually');
    }
  }
}
