import { createHash, randomBytes } from 'node:crypto';
import { ApiTags, ApiCookieAuth, ApiSecurity } from '@nestjs/swagger';
import {
  BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get,
  Injectable, NotFoundException, Param, Patch, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Connection, Model, Types } from 'mongoose';
import { Request } from 'express';
import { PasswordService } from '../auth/password.service';
import { foodForWorkspace, recipeForWorkspace, escapedSearch } from './catalogue.mapper';
import { CsrfGuard } from '../auth/csrf.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User, UserRole } from '../auth/user.schema';
import {
  AppointmentDto, AppointmentEditDto, AssignmentDto, ClinicalNoteDto, CreatePatientInviteDto, PatientStatusDto, PatientProfileDto, PatientMessageDto, FoodEntryDto, LayoutDto, PlanEditDto,
  PlanEntryDto, ProgressDto, RecipeDto,
} from './workspace.dto';

const COLLECTION = {
  entries: 'FoodEntries', recipes: 'Recipes', plans: 'DietPlans',
  appointments: 'Appointments', assignments: 'PatientAssignments',
  layouts: 'DashboardLayouts', progress: 'ProgressEntries',
  foods: 'Foods', tags: 'Tags', messages: 'PatientMessages', notes: 'ClinicalNotes', audits: 'AuditEvents', tokens: 'AccountTokens', profiles: 'PatientProfiles',
} as const;
const VALID_WIDGETS = [
  'patients', 'meetings', 'reviews', 'plans', 'activity', 'appointments', 'dietitians',
] as const;
const oid = (id: string) => new Types.ObjectId(id);
const out = (doc: Record<string, any>) => {
  const { _id, ...fields } = doc;
  return { id: String(_id), ...fields };
};

@Injectable()
@ApiTags('Workspace')
@ApiCookieAuth()
@Controller('workspace')
@Roles('admin', 'dietitian', 'patient')
@UseGuards(RolesGuard)
export class WorkspaceController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly passwords: PasswordService,
  ) {}

  private collection(name: keyof typeof COLLECTION) {
    return this.connection.db!.collection(COLLECTION[name]);
  }

  private async identity(req: Request) {
    const user = await this.users.findById(req.session.userId).select('role email').lean();
    if (!user) throw new ForbiddenException();
    return { id: String(user._id), role: user.role as UserRole };
  }

  private validId(value: string) {
    if (!Types.ObjectId.isValid(value) || String(oid(value)) !== value.toLowerCase()) {
      throw new BadRequestException('Invalid resource ID');
    }
    return oid(value);
  }

  // One access check for every patient-scoped read and practitioner write.
  private async patientId(req: Request, requested?: string) {
    const user = await this.identity(req);
    const target = requested || (user.role === 'patient' ? user.id : '');
    if (!target) throw new BadRequestException('Select a patient');
    const id = this.validId(target);
    if (user.role === 'patient' && target !== user.id) throw new ForbiddenException();
    if (user.role === 'dietitian') {
      const assigned = await this.collection('assignments').findOne({
        patientId: id, dietitianId: oid(user.id),
      });
      if (!assigned) throw new ForbiddenException('Not assigned to this patient');
    }
    const patient = await this.users.findOne({ _id: id, role: 'patient', active: true, deletedAt: { $exists: false } }).select('_id').lean();
    if (!patient) throw new NotFoundException('Patient not found');
    return id;
  }

  private async staff(req: Request) {
    const user = await this.identity(req);
    if (user.role === 'patient') throw new ForbiddenException();
    return user;
  }

  private range(from?: string, to?: string) {
    const start = from ? new Date(from) : new Date(Date.now() - 31 * 86400000);
    const end = to ? new Date(to) : new Date(Date.now() + 31 * 86400000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) ||
        end < start || end.getTime() - start.getTime() > 370 * 86400000) {
      throw new BadRequestException('Invalid date range (maximum 370 days)');
    }
    return { $gte: start, $lte: end };
  }

  @Get('patients')
  @Roles('admin', 'dietitian')
  async patients(@Req() req: Request) {
    const user = await this.staff(req);
    const ids = user.role === 'dietitian'
      ? (await this.collection('assignments').find({ dietitianId: oid(user.id) }).limit(500).toArray()).map(a => a.patientId)
      : undefined;
    if (ids && ids.length === 0) return [];
    const records = await this.users.find({
      role: 'patient', deletedAt: { $exists: false }, ...(user.role !== 'admin' ? { active: true } : {}), ...(ids ? { _id: { $in: ids } } : {}),
    }).select('email active').sort({ email: 1 }).limit(500).lean();
    return records.map(r => ({ id: String(r._id), email: r.email, active: r.active }));
  }

  private async issuePatientInvitation(userId: Types.ObjectId, adminId: Types.ObjectId) {
    const now = new Date();
    // Superseded links cannot be redeemed, even if still within the 48-hour window.
    await this.collection('tokens').updateMany({
      userId, purpose: 'patient-invite', usedAt: { $exists: false },
    }, { $set: { usedAt: now } });
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    await this.collection('tokens').insertOne({
      purpose: 'patient-invite', userId, tokenHash, expiresAt, createdBy: adminId, createdAt: now,
    });
    await this.collection('audits').insertOne({
      action: 'patient.invited', actorId: adminId, patientId: userId, createdAt: now,
    });
    return { token, expiresAt };
  }

  @ApiSecurity('csrf')
  @Post('patients/invitations')
  @Roles('admin')
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async invitePatient(@Req() req: Request, @Body() dto: CreatePatientInviteDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.users.exists({ email })) throw new ConflictException('Patient account already exists');
    const now = new Date();
    // Placeholder password is never disclosed or used. The patient chooses a new one using
    // a single-use invitation token. Tokens are hashed before storage.
    const passwordHash = await this.passwords.hash(randomBytes(48).toString('hex'));
    let patient;
    try {
      patient = await this.users.create({ email, passwordHash, role: 'patient', active: false, sessionVersion: 0 });
    } catch (cause) {
      if ((cause as { code?: number }).code === 11000) throw new ConflictException('Patient account already exists');
      throw cause;
    }
    const invitation = await this.issuePatientInvitation(patient._id, oid(req.session.userId!));
    // Only returned to the authenticated administrator ONCE. Never store plaintext token.
    return { id: String(patient._id), ...invitation };
  }

  @ApiSecurity('csrf')
  @Post('patients/:id/invitations')
  @Roles('admin')
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async reissuePatientInvitation(@Req() req: Request, @Param('id') id: string) {
    const user = await this.users.findOne({
      _id: this.validId(id), role: 'patient', active: false, deletedAt: { $exists: false },
    }).select('_id').lean();
    if (!user) throw new NotFoundException('Inactive patient not found');
    return this.issuePatientInvitation(user._id as Types.ObjectId, oid(req.session.userId!));
  }

  @ApiSecurity('csrf')
  @Patch('patients/:id/status')
  @Roles('admin')
  @UseGuards(CsrfGuard)
  async setPatientStatus(@Param('id') id: string, @Body() dto: PatientStatusDto) {
    const result = await this.users.updateOne(
      { _id: this.validId(id), role: 'patient', deletedAt: { $exists: false } },
      { $set: { active: dto.active }, $inc: { sessionVersion: 1 } },
    );
    if (!result.matchedCount) throw new NotFoundException('Patient not found');
    return { ok: true, active: dto.active };
  }

  @ApiSecurity('csrf')
  @Delete('patients/:id')
  @Roles('admin')
  @UseGuards(CsrfGuard)
  async deletePatient(@Param('id') id: string) {
    // Soft delete: preserve clinical records until a separately authorised retention/deletion workflow is implemented.
    const result = await this.users.updateOne(
      { _id: this.validId(id), role: 'patient', deletedAt: { $exists: false } },
      { $set: { active: false, deletedAt: new Date() }, $inc: { sessionVersion: 1 } },
    );
    if (!result.matchedCount) throw new NotFoundException('Patient not found');
    return { ok: true };
  }

  @Get('patient-profile')
  async patientProfile(@Req() req: Request, @Query('patientId') patient?: string) {
    const patientId = await this.patientId(req, patient);
    const record = await this.collection('profiles').findOne({ patientId });
    return { patientId: String(patientId), displayName: record?.displayName || '',
      timezone: record?.timezone || 'UTC' };
  }

  @ApiSecurity('csrf')
  @Patch('patient-profile')
  @Roles('patient')
  @UseGuards(CsrfGuard)
  async updateMyProfile(@Req() req: Request, @Body() dto: PatientProfileDto) {
    const patientId = await this.patientId(req);
    if (!Object.keys(dto).length) throw new BadRequestException('No profile changes supplied');
    if (dto.timezone) {
      try { new Intl.DateTimeFormat('en-US', { timeZone: dto.timezone }); }
      catch { throw new BadRequestException('Invalid timezone'); }
    }
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.displayName !== undefined) update.displayName = dto.displayName.trim();
    if (dto.timezone !== undefined) update.timezone = dto.timezone;
    await this.collection('profiles').updateOne({ patientId },
      { $set: update, $setOnInsert: { patientId, createdAt: new Date() } }, { upsert: true });
    await this.collection('audits').insertOne({
      action: 'profile.updated', actorId: patientId, patientId, createdAt: new Date(),
    });
    return { ok: true };
  }

  @Get('dietitians')
  @Roles('admin')
  async dietitians() {
    const records = await this.users.find({ role: 'dietitian', active: true })
      .select('email').sort({ email: 1 }).limit(500).lean();
    return records.map(r => ({ id: String(r._id), email: r.email }));
  }

  @ApiSecurity('csrf')
  @Post('assignments')
  @Roles('admin')
  @UseGuards(CsrfGuard)
  async assign(@Body() dto: AssignmentDto, @Req() req: Request) {
    await this.patientId(req, dto.patientId);
    const clinician = await this.users.findOne({
      _id: this.validId(dto.dietitianId), role: 'dietitian', active: true,
    }).select('_id').lean();
    if (!clinician) throw new BadRequestException('Dietitian is not active');
    await this.collection('assignments').updateOne(
      { patientId: oid(dto.patientId), dietitianId: oid(dto.dietitianId) },
      { $setOnInsert: { createdAt: new Date(), assignedBy: oid(req.session.userId!) } },
      { upsert: true },
    );
    return { ok: true };
  }

  @Get('recipes')
  async recipes(@Req() req: Request) {
    const user = await this.identity(req);
    // Hide explicit drafts from patients; legacy recipes without isPublished remain accessible.
    const filter = user.role === 'patient' ? { isPublished: { $ne: false } } : {};
    return (await this.collection('recipes').find(filter).sort({ name: 1 }).limit(250).toArray())
      .map(doc => recipeForWorkspace(doc));
  }

  @Get('foods')
  async foods(@Query('q') q?: string, @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string, @Query('categoryId') categoryId?: string) {
    if (q !== undefined && (typeof q !== 'string' || q.length > 100)) {
      throw new BadRequestException('Search must be at most 100 characters');
    }
    const page = pageRaw === undefined ? 1 : Number(pageRaw);
    const limit = limitRaw === undefined ? 25 : Number(limitRaw);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000 ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Invalid page or limit');
    }
    const filter: Record<string, unknown> = {};
    const term = (q || '').trim();
    if (term) filter.name = { $regex: escapedSearch(term), $options: 'i' };
    if (categoryId !== undefined) {
      if (typeof categoryId !== 'string') throw new BadRequestException('Invalid category');
      filter.categoryId = this.validId(categoryId);
    }
    // Avoid sending embedded USDA variant arrays with search results.
    const [rows, total] = await Promise.all([
      this.collection('foods').find(filter, { projection: {
        name: 1, foodType: 1, categoryId: 1, tagIds: 1, nutritionPer100g: 1,
        portions: 1, 'source.canonicalFdcId': 1, 'source.dataset': 1,
      } }).sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).toArray(),
      this.collection('foods').countDocuments(filter),
    ]);
    const ids = [...new Set(rows.flatMap(row => [row.categoryId,
      ...(Array.isArray(row.tagIds) ? row.tagIds : [])].filter(Boolean).map(String)))];
    const tagDocs = ids.length ? await this.collection('tags')
      .find({ _id: { $in: ids.map(id => new Types.ObjectId(id)) } },
        { projection: { slug: 1, label: 1, name: 1 } }).toArray() : [];
    const tags = new Map(tagDocs.map(tag => [String(tag._id), tag]));
    return { items: rows.map(row => foodForWorkspace(row, tags)), total,
      page, limit, pages: Math.ceil(total / limit) };
  }

  @ApiSecurity('csrf')
  @Post('recipes')
  @Roles('admin', 'dietitian')
  @UseGuards(CsrfGuard)
  async addRecipe(@Req() req: Request, @Body() dto: RecipeDto) {
    const user = await this.staff(req);
    const now = new Date();
    const result = await this.collection('recipes').insertOne({
      ...dto, name: dto.name.trim(), createdBy: oid(user.id), createdAt: now, updatedAt: now,
    });
    return { id: String(result.insertedId) };
  }

  @ApiSecurity('csrf')
  @Patch('recipes/:id')
  @Roles('admin', 'dietitian')
  @UseGuards(CsrfGuard)
  async editRecipe(@Req() req: Request, @Param('id') id: string, @Body() dto: RecipeDto) {
    await this.staff(req);
    const result = await this.collection('recipes').updateOne(
      { _id: this.validId(id) }, { $set: { ...dto, name: dto.name.trim(), updatedAt: new Date() } },
    );
    if (!result.matchedCount) throw new NotFoundException();
    return { ok: true };
  }

  @ApiSecurity('csrf')
  @Delete('recipes/:id')
  @Roles('admin', 'dietitian')
  @UseGuards(CsrfGuard)
  async deleteRecipe(@Req() req: Request, @Param('id') id: string) {
    await this.staff(req);
    await this.collection('recipes').deleteOne({ _id: this.validId(id) });
    return { ok: true };
  }

  @Get('entries')
  async entries(@Req() req: Request, @Query('patientId') patient?: string,
    @Query('from') from?: string, @Query('to') to?: string) {
    const id = await this.patientId(req, patient);
    return (await this.collection('entries').find({
      patientId: id, eatenAt: this.range(from, to),
    }).sort({ eatenAt: -1 }).limit(250).toArray()).map(out);
  }

  @ApiSecurity('csrf')
  @Post('entries')
  @Roles('patient')
  @UseGuards(CsrfGuard)
  async addEntry(@Req() req: Request, @Body() dto: FoodEntryDto) {
    const identity = await this.identity(req);
    const date = new Date(dto.eatenAt);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid eating time');
    let nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    if (dto.recipeId) {
      if (dto.unit !== 'serving') throw new BadRequestException('Recipe quantities must use serving units');
      const recipe = await this.collection('recipes').findOne({ _id: this.validId(dto.recipeId) });
      if (!recipe) throw new BadRequestException('Recipe not found');
      nutrition = {
        calories: (recipe.calories || 0) * dto.quantity,
        protein: (recipe.protein || 0) * dto.quantity,
        carbs: (recipe.carbs || 0) * dto.quantity,
        fat: (recipe.fat || 0) * dto.quantity,
        fiber: (recipe.fiber || 0) * dto.quantity,
      };
    }
    const result = await this.collection('entries').insertOne({
      patientId: oid(identity.id), foodName: dto.foodName.trim(),
      eatenAt: date, quantity: dto.quantity, unit: dto.unit.trim(),
      ...(dto.recipeId ? { recipeId: oid(dto.recipeId) } : {}),
      notes: dto.notes || '', nutrition, nutritionAvailable: Boolean(dto.recipeId),
      createdAt: new Date(), updatedAt: new Date(),
    });
    return { id: String(result.insertedId) };
  }

  @ApiSecurity('csrf')
  @Patch('entries/:id')
  @Roles('patient')
  @UseGuards(CsrfGuard)
  async editEntry(@Req() req: Request, @Param('id') id: string, @Body() dto: FoodEntryDto) {
    let nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    if (dto.recipeId) {
      if (dto.unit !== 'serving') throw new BadRequestException('Recipe quantities must use serving units');
      const recipe = await this.collection('recipes').findOne({ _id: this.validId(dto.recipeId) });
      if (!recipe) throw new BadRequestException('Recipe not found');
      nutrition = {
        calories: (recipe.calories || 0) * dto.quantity,
        protein: (recipe.protein || 0) * dto.quantity,
        carbs: (recipe.carbs || 0) * dto.quantity,
        fat: (recipe.fat || 0) * dto.quantity,
        fiber: (recipe.fiber || 0) * dto.quantity,
      };
    }
    const r = await this.collection('entries').updateOne({
      _id: this.validId(id), patientId: oid(req.session.userId!),
    }, { $set: {
      foodName: dto.foodName.trim(), eatenAt: new Date(dto.eatenAt), quantity: dto.quantity,
      unit: dto.unit, notes: dto.notes || '', nutrition,
      recipeId: dto.recipeId ? oid(dto.recipeId) : null,
      nutritionAvailable: Boolean(dto.recipeId), updatedAt: new Date(),
    } });
    if (!r.matchedCount) throw new NotFoundException();
    return { ok: true };
  }

  @ApiSecurity('csrf')
  @Delete('entries/:id')
  @Roles('patient')
  @UseGuards(CsrfGuard)
  async deleteEntry(@Req() req: Request, @Param('id') id: string) {
    await this.collection('entries').deleteOne({
      _id: this.validId(id), patientId: oid(req.session.userId!),
    });
    return { ok: true };
  }

  @Get('plans')
  async plans(@Req() req: Request, @Query('patientId') patient?: string,
    @Query('from') from?: string, @Query('to') to?: string) {
    const id = await this.patientId(req, patient);
    const identity = await this.identity(req);
    const records = await this.collection('plans').find({
      patientId: id, plannedAt: this.range(from, to),
      ...(identity.role === 'patient' ? { status: 'published' } : {}),
    }).sort({ plannedAt: 1 }).limit(250).toArray();
    return records.map(out);
  }

  @ApiSecurity('csrf')
  @Post('plans')
  @Roles('admin', 'dietitian')
  @UseGuards(CsrfGuard)
  async addPlan(@Req() req: Request, @Body() dto: PlanEntryDto) {
    const user = await this.staff(req);
    const patientId = await this.patientId(req, dto.patientId);
    if (dto.recipeId && !await this.collection('recipes').findOne({ _id: this.validId(dto.recipeId) })) {
      throw new BadRequestException('Recipe not found');
    }
    const result = await this.collection('plans').insertOne({
      patientId, title: dto.title.trim(), plannedAt: new Date(dto.plannedAt),
      status: dto.status, notes: dto.notes || '',
      ...(dto.recipeId ? { recipeId: oid(dto.recipeId) } : {}),
      createdBy: oid(user.id), createdAt: new Date(), updatedAt: new Date(),
    });
    return { id: String(result.insertedId) };
  }

  @ApiSecurity('csrf')
  @Patch('plans/:id')
  @Roles('admin', 'dietitian')
  @UseGuards(CsrfGuard)
  async editPlan(@Req() req: Request, @Param('id') id: string, @Body() dto: PlanEditDto) {
    await this.staff(req);
    const record = await this.collection('plans').findOne({ _id: this.validId(id) });
    if (!record) throw new NotFoundException();
    await this.patientId(req, String(record.patientId));
    if (Object.keys(dto).length === 0) throw new BadRequestException('No updates');
    const update: Record<string, unknown> = { ...dto, updatedAt: new Date() };
    if (dto.plannedAt) update.plannedAt = new Date(dto.plannedAt);
    if (dto.title) update.title = dto.title.trim();
    await this.collection('plans').updateOne({ _id: record._id }, { $set: update });
    return { ok: true };
  }

  @ApiSecurity('csrf')
  @Delete('plans/:id')
  @Roles('admin', 'dietitian')
  @UseGuards(CsrfGuard)
  async deletePlan(@Req() req: Request, @Param('id') id: string) {
    await this.staff(req);
    const record = await this.collection('plans').findOne({ _id: this.validId(id) });
    if (!record) throw new NotFoundException();
    await this.patientId(req, String(record.patientId));
    await this.collection('plans').deleteOne({ _id: record._id });
    return { ok: true };
  }

  @Get('appointments')
  async appointments(@Req() req: Request, @Query('patientId') patient?: string) {
    const identity = await this.identity(req);
    let filter: Record<string, any>;
    if (identity.role === 'patient' || patient) {
      const patientId = await this.patientId(req, patient);
      filter = { patientId, ...(identity.role === 'dietitian' ? { dietitianId: oid(identity.id) } : {}) };
    } else if (identity.role === 'dietitian') {
      filter = { dietitianId: oid(identity.id) };
    } else {
      filter = {};
    }
    return (await this.collection('appointments').find(filter).sort({ startsAt: 1 }).limit(250).toArray()).map(out);
  }

  @ApiSecurity('csrf')
  @Post('appointments')
  @Roles('admin', 'dietitian')
  @UseGuards(CsrfGuard)
  async addAppointment(@Req() req: Request, @Body() dto: AppointmentDto) {
    const identity = await this.staff(req);
    await this.patientId(req, dto.patientId);
    if (identity.role === 'dietitian' && identity.id !== dto.dietitianId) throw new ForbiddenException();
    const clinician = await this.users.findOne({
      _id: this.validId(dto.dietitianId), role: 'dietitian', active: true,
    }).select('_id').lean();
    if (!clinician) throw new BadRequestException('Dietitian unavailable');
    const result = await this.collection('appointments').insertOne({
      patientId: oid(dto.patientId), dietitianId: oid(dto.dietitianId),
      startsAt: new Date(dto.startsAt), title: dto.title.trim(),
      durationMinutes: dto.durationMinutes, createdAt: new Date(), createdBy: oid(identity.id),
    });
    return { id: String(result.insertedId) };
  }

  @ApiSecurity('csrf')
  @Delete('appointments/:id')
  @Roles('admin', 'dietitian')
  @UseGuards(CsrfGuard)
  async deleteAppointment(@Req() req: Request, @Param('id') id: string) {
    const user = await this.staff(req);
    const item = await this.collection('appointments').findOne({ _id: this.validId(id) });
    if (!item) throw new NotFoundException();
    await this.patientId(req, String(item.patientId));
    if (user.role === 'dietitian' && String(item.dietitianId) !== user.id) throw new ForbiddenException();
    await this.collection('appointments').deleteOne({ _id: item._id });
    return { ok: true };
  }

  // Care-team messages are scoped by the same patient-assignment policy as the food diary.
  // No attachments, outbound notifications or third-party processors at this stage.
  @Get('messages')
  async messages(@Req() req: Request, @Query('patientId') patient?: string) {
    const patientId = await this.patientId(req, patient);
    return (await this.collection('messages').find({ patientId })
      .sort({ createdAt: -1, _id: -1 }).limit(100).toArray()).reverse().map(out);
  }

  @ApiSecurity('csrf')
  @Post('messages')
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  async sendMessage(@Req() req: Request, @Body() dto: PatientMessageDto) {
    const user = await this.identity(req);
    const patientId = await this.patientId(req, dto.patientId);
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Message cannot be blank');
    const now = new Date();
    const result = await this.collection('messages').insertOne({
      patientId, senderId: oid(user.id), senderRole: user.role,
      body, createdAt: now,
    });
    await this.collection('audits').insertOne({
      action: 'message.sent', actorId: oid(user.id), patientId, resourceId: result.insertedId,
      createdAt: now,
    });
    return { id: String(result.insertedId) };
  }

  // Clinical notes are PRIVATE to authorised practitioners, never included in patient views.
  @Get('notes')
  @Roles('admin', 'dietitian')
  async clinicalNotes(@Req() req: Request, @Query('patientId') patient?: string) {
    const patientId = await this.patientId(req, patient);
    const user = await this.identity(req);
    const notes = await this.collection('notes').find({ patientId, deletedAt: { $exists: false } })
      .sort({ createdAt: -1, _id: -1 }).limit(100).toArray();
    await this.collection('audits').insertOne({
      action: 'notes.viewed', actorId: oid(user.id), patientId, createdAt: new Date(),
    });
    return notes.map(out);
  }

  @ApiSecurity('csrf')
  @Post('notes')
  @Roles('admin', 'dietitian')
  @UseGuards(CsrfGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async addClinicalNote(@Req() req: Request, @Body() dto: ClinicalNoteDto) {
    const user = await this.staff(req);
    const patientId = await this.patientId(req, dto.patientId);
    const title = dto.title.trim();
    const body = dto.body.trim();
    if (!title || !body) throw new BadRequestException('Title and note body are required');
    const now = new Date();
    const result = await this.collection('notes').insertOne({
      patientId, title, body, authorId: oid(user.id), createdAt: now, updatedAt: now,
    });
    await this.collection('audits').insertOne({
      action: 'note.created', actorId: oid(user.id), patientId,
      resourceId: result.insertedId, createdAt: now,
    });
    return { id: String(result.insertedId) };
  }

  @ApiSecurity('csrf')
  @Patch('appointments/:id')
  @Roles('admin', 'dietitian')
  @UseGuards(CsrfGuard)
  async editAppointment(@Req() req: Request, @Param('id') id: string, @Body() dto: AppointmentEditDto) {
    const user = await this.staff(req);
    const current = await this.collection('appointments').findOne({ _id: this.validId(id) });
    if (!current) throw new NotFoundException();
    await this.patientId(req, String(current.patientId));
    if (user.role === 'dietitian' && String(current.dietitianId) !== user.id) throw new ForbiddenException();
    if (!Object.keys(dto).length) throw new BadRequestException('No changes supplied');
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.title !== undefined) {
      if (!dto.title.trim()) throw new BadRequestException('Title required');
      updates.title = dto.title.trim();
    }
    if (dto.startsAt !== undefined) updates.startsAt = new Date(dto.startsAt);
    if (dto.durationMinutes !== undefined) updates.durationMinutes = dto.durationMinutes;
    await this.collection('appointments').updateOne({ _id: current._id }, { $set: updates });
    await this.collection('audits').insertOne({
      action: 'appointment.updated', actorId: oid(user.id), patientId: current.patientId,
      resourceId: current._id, createdAt: new Date(),
    });
    return { ok: true };
  }

  // Deterministic diary totals; unknown nutrition is counted, never guessed.
  @Get('nutrition-report')
  async nutritionReport(@Req() req: Request, @Query('patientId') patient?: string,
    @Query('days') daysRaw?: string) {
    const patientId = await this.patientId(req, patient);
    const days = daysRaw === undefined ? 30 : Number(daysRaw);
    if (![7, 30, 90].includes(days)) throw new BadRequestException('Days must be 7, 30 or 90');
    const since = new Date(Date.now() - days * 86400000);
    const rows = await this.collection('entries').find({
      patientId, eatenAt: { $gte: since, $lte: new Date() },
    }, { projection: { eatenAt: 1, nutrition: 1, nutritionAvailable: 1 } })
      .sort({ eatenAt: -1, _id: -1 }).limit(2500).toArray();
    const daily = new Map<string, { date: string; known: number; unknown: number;
      calories: number; protein: number; carbs: number; fat: number; fiber: number }>();
    for (const row of rows) {
      const date = new Date(row.eatenAt).toISOString().slice(0, 10);
      const day = daily.get(date) || { date, known: 0, unknown: 0,
        calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      if (!row.nutritionAvailable || !row.nutrition) day.unknown++;
      else {
        day.known++;
        for (const key of ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const) {
          const value = row.nutrition[key];
          if (typeof value === 'number' && Number.isFinite(value) && value >= 0) day[key] += value;
        }
      }
      daily.set(date, day);
    }
    return { days, timezone: 'UTC', truncated: rows.length === 2500,
      items: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
      known: [...daily.values()].reduce((n, d) => n + d.known, 0),
      unknown: [...daily.values()].reduce((n, d) => n + d.unknown, 0) };
  }

  @Get('progress')
  async progress(@Req() req: Request, @Query('patientId') patient?: string) {
    const patientId = await this.patientId(req, patient);
    return (await this.collection('progress').find({ patientId })
      .sort({ measuredAt: -1 }).limit(100).toArray()).map(out);
  }

  @ApiSecurity('csrf')
  @Post('progress')
  @Roles('patient')
  @UseGuards(CsrfGuard)
  async addProgress(@Req() req: Request, @Body() dto: ProgressDto) {
    const r = await this.collection('progress').insertOne({
      ...dto, measuredAt: new Date(dto.measuredAt),
      patientId: oid(req.session.userId!), createdAt: new Date(),
    });
    return { id: String(r.insertedId) };
  }

  @Get('layout')
  @Roles('admin', 'dietitian')
  async layout(@Req() req: Request) {
    const user = await this.staff(req);
    const layout = await this.collection('layouts').findOne({ userId: oid(user.id) });
    return { widgets: layout?.widgets || [...VALID_WIDGETS] };
  }

  @ApiSecurity('csrf')
  @Put('layout')
  @Roles('admin', 'dietitian')
  @UseGuards(CsrfGuard)
  async updateLayout(@Req() req: Request, @Body() dto: LayoutDto) {
    const user = await this.staff(req);
    if (new Set(dto.widgets).size !== dto.widgets.length ||
        dto.widgets.some(widget => !VALID_WIDGETS.includes(widget as typeof VALID_WIDGETS[number]))) {
      throw new BadRequestException('Invalid widget list');
    }
    await this.collection('layouts').updateOne(
      { userId: oid(user.id) },
      { $set: { widgets: dto.widgets, updatedAt: new Date() } },
      { upsert: true },
    );
    return { widgets: dto.widgets };
  }

  @Get('stats')
  async stats(@Req() req: Request, @Query('offset') offset?: string) {
    const user = await this.identity(req);
    const now = new Date();
    const minutes = offset === undefined ? 0 : Number(offset);
    if (!Number.isInteger(minutes) || minutes < -840 || minutes > 840) {
      throw new BadRequestException('Invalid timezone offset');
    }
    const localMs = now.getTime() - minutes * 60000;
    const start = new Date(Math.floor(localMs / 86400000) * 86400000 + minutes * 60000);
    const end = new Date(start.getTime() + 86400000);
    if (user.role === 'patient') {
      const [entries, appointments, plans, progress] = await Promise.all([
        this.collection('entries').find({ patientId: oid(user.id), eatenAt: { $gte: start, $lt: end } }).limit(250).toArray(),
        this.collection('appointments').countDocuments({ patientId: oid(user.id), startsAt: { $gte: now } }),
        this.collection('plans').countDocuments({ patientId: oid(user.id), status: 'published' }),
        this.collection('progress').countDocuments({ patientId: oid(user.id) }),
      ]);
      const total = (field: string) => Math.round(entries.reduce((sum, e) => sum + (e.nutrition?.[field] || 0), 0));
      return { role: user.role, values: { entries: entries.length, calories: total('calories'),
        protein: total('protein'), appointments, plans, progress } };
    }
    let patients: number;
    let planFilter: Record<string, unknown> = {};
    let appointmentFilter: Record<string, unknown> = {};
    if (user.role === 'dietitian') {
      const assignments = await this.collection('assignments').find({ dietitianId: oid(user.id) }).limit(500).toArray();
      const ids = assignments.map(x => x.patientId);
      patients = await this.users.countDocuments({ role: 'patient', active: true, _id: { $in: ids } });
      planFilter = { patientId: { $in: ids } };
      appointmentFilter = { dietitianId: oid(user.id) };
    } else {
      patients = await this.users.countDocuments({ role: 'patient', active: true });
    }
    const [meetings, plans, dietitians] = await Promise.all([
      this.collection('appointments').countDocuments({
        ...appointmentFilter, startsAt: { $gte: start, $lt: end },
      }),
      this.collection('plans').countDocuments({ ...planFilter, status: 'published' }),
      user.role === 'admin'
        ? this.users.countDocuments({ role: 'dietitian', active: true })
        : Promise.resolve(0),
    ]);
    return { role: user.role, values: { patients, meetings, reviews: 0, plans, activity: 0,
      appointments: meetings, dietitians } };
  }
}
