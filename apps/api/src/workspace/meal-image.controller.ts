import { BadRequestException, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException,
  Param, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiCookieAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { ObjectId } from 'mongodb';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { User } from '../auth/user.schema';
import { MAX_RAW_IMAGE_BYTES, MealImageService } from './meal-image.service';

type MealUpload = { buffer: Buffer; size: number; mimetype: string };
const toOid = (id: string) => {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new BadRequestException('Invalid entry ID');
  return new ObjectId(id);
};

@Controller('workspace/entries')
@ApiTags('Meal images')
@ApiCookieAuth()
@Roles('admin','dietitian','patient')
@UseGuards(RolesGuard)
export class MealImageController {
  constructor(@InjectConnection() private readonly connection: Connection,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly images: MealImageService) {}

  private async authorised(req: Request, id: string) {
    const entry = await this.connection.db!.collection('FoodEntries').findOne({ _id: toOid(id) });
    if (!entry) throw new NotFoundException('Entry not found');
    const caller = await this.users.findById(req.session.userId).select('role').lean();
    if (!caller) throw new ForbiddenException();
    const patientId = String(entry.patientId);
    const patient = await this.users.findOne({
      _id: new ObjectId(patientId), role: 'patient', active:true, deletedAt: { $exists: false },
    }).select('_id').lean();
    if (!patient) throw new NotFoundException('Patient unavailable');
    if (caller.role === 'patient' && String(caller._id) !== patientId) throw new ForbiddenException();
    if (caller.role === 'dietitian') {
      const assignment = await this.connection.db!.collection('PatientAssignments').findOne({
        patientId: new ObjectId(patientId), dietitianId: new ObjectId(String(caller._id)),
      });
      if (!assignment) throw new ForbiddenException('Not assigned to this patient');
    }
    return { entry, caller, patientId: new ObjectId(patientId) };
  }

  @ApiSecurity('csrf')
  @Post(':id/image')
  @Roles('patient')
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: MAX_RAW_IMAGE_BYTES, files: 1, fields: 0, parts: 1 },
  }))
  async upload(@Req() req: Request, @Param('id') id: string,
    @UploadedFile() file?: MealUpload) {
    const { entry, caller, patientId } = await this.authorised(req,id);
    if (!file || !file.buffer) throw new BadRequestException('Select a JPEG, PNG or WebP image');
    const clean = await this.images.sanitise(file.buffer);
    const imageId = await this.images.save(clean, patientId, entry._id);
    try {
      const result = await this.connection.db!.collection('FoodEntries').updateOne({
        _id: entry._id, patientId,
        ...(entry.imageId ? { imageId:entry.imageId } : { imageId:{$exists:false} }),
      }, { $set: { imageId, imageUpdatedAt: new Date(), imageOrigin:'patient' } });
      if (!result.matchedCount) throw new ConflictException('The entry or photo changed; reload and retry');
    } catch (error) { await this.images.remove(imageId); throw error; }
    if (entry.imageId) await this.images.remove(entry.imageId);
    // No source filename or EXIF metadata is retained in the DB or the returned body.
    return { uploaded: true };
  }

  @Get(':id/image')
  async download(@Req() req: Request, @Param('id') id: string, @Res() res: Response) {
    const { entry } = await this.authorised(req,id);
    if (!entry.imageId) throw new NotFoundException('No image recorded');
    const bytes = await this.images.read(entry.imageId);
    res.set('Content-Type','image/webp');
    res.set('Cache-Control','private, no-store, max-age=0');
    res.set('X-Content-Type-Options','nosniff');
    res.set('Content-Disposition','inline; filename="meal.webp"');
    res.send(bytes);
  }

  @ApiSecurity('csrf')
  @Delete(':id/image')
  @Roles('patient')
  @UseGuards(CsrfGuard)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const { entry, patientId } = await this.authorised(req,id);
    if (!entry.imageId) return { ok:true };
    const result = await this.connection.db!.collection('FoodEntries').updateOne({
      _id:entry._id, patientId, imageId:entry.imageId,
    }, { $unset:{ imageId: '' }, $set: { imageUpdatedAt:new Date() } });
    if (!result.matchedCount) throw new ConflictException('Photo changed; reload and retry');
    await this.images.remove(entry.imageId);
    return { ok:true };
  }

  @ApiSecurity('csrf')
  @Post(':id/recognise')
  @Roles('patient')
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async recognise(@Req() req: Request, @Param('id') id: string) {
    const { entry } = await this.authorised(req,id);
    if (!entry.imageId) throw new BadRequestException('Upload an image before recognition');
    const image = await this.images.read(entry.imageId);
    const candidates = await this.images.recognise(image);
    // Suggestions only. No automatic nutrient computation or changes to diary entries.
    return { candidates, requiresConfirmation:true };
  }
}
