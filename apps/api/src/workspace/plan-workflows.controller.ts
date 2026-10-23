import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException,
  Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { User } from '../auth/user.schema';
import { ApplyPlanTemplateDto, CreatePlanTemplateDto, DuplicatePlanWeekDto,
  PublishPlanWeekDto, PlanTemplateItemDto } from './plan-workflows.dto';

const MS_DAY = 86400000;
const toId = (s: string) => {
  if (!/^[a-f0-9]{24}$/i.test(s)) throw new BadRequestException('Invalid ID');
  return new Types.ObjectId(s);
};
export function mondayUTC(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Use YYYY-MM-DD');
  const date = new Date(value + 'T00:00:00.000Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== value || date.getUTCDay() !== 1) {
    throw new BadRequestException('Select a valid Monday in UTC');
  }
  return date;
}
function datesForWeek(week: string) {
  const first = mondayUTC(week);
  return { first, last: new Date(first.getTime() + 7 * MS_DAY) };
}

@Controller('workspace')
@ApiTags('Diet plan workflows')
@ApiCookieAuth()
@Roles('admin','dietitian')
@UseGuards(RolesGuard)
export class PlanWorkflowsController {
  constructor(@InjectConnection() private readonly connection: Connection,
    @InjectModel(User.name) private readonly users: Model<User>) {}
  private db() { return this.connection.db!; }
  private async caller(req: Request) {
    const user = await this.users.findById(req.session.userId).select('role').lean();
    if (!user || !['admin','dietitian'].includes(user.role)) throw new ForbiddenException();
    return { id: new Types.ObjectId(String(user._id)), role: user.role };
  }
  private async patient(req: Request, patientId: string) {
    const staff = await this.caller(req);
    const id = toId(patientId);
    const active = await this.users.findOne({
      _id:id, role:'patient', active:true, deletedAt:{$exists:false},
    }).select('_id').lean();
    if (!active) throw new NotFoundException('Patient not found');
    if (staff.role === 'dietitian' && !await this.db().collection('PatientAssignments').findOne({
      patientId:id,dietitianId:staff.id,
    })) throw new ForbiddenException('Patient not assigned');
    return { id, staff };
  }

  private async checkRecipeIds(items: PlanTemplateItemDto[]) {
    const ids = [...new Set(items.filter(x => x.recipeId).map(x => x.recipeId!))];
    if (!ids.length) return;
    const count = await this.db().collection('Recipes').countDocuments({
      _id:{ $in:ids.map(toId) },
    });
    if (count !== ids.length) throw new BadRequestException('One or more recipes do not exist');
  }

  @Get('plan-templates')
  async listTemplates(@Req() req: Request) {
    const staff = await this.caller(req);
    const records = await this.db().collection('DietPlanTemplates').find({ createdBy:staff.id })
      .sort({ createdAt:-1 }).limit(100).toArray();
    return records.map(x => ({ id:String(x._id),name:x.name,items:x.items,createdAt:x.createdAt }));
  }

  @ApiSecurity('csrf')
  @Post('plan-templates')
  @UseGuards(CsrfGuard)
  async saveTemplate(@Req() req: Request, @Body() dto: CreatePlanTemplateDto) {
    const staff = await this.caller(req);
    if (!dto.name.trim() || dto.items.some(item => !item.title.trim())) {
      throw new BadRequestException('Template names and item names cannot be blank');
    }
    await this.checkRecipeIds(dto.items);
    const record = await this.db().collection('DietPlanTemplates').insertOne({
      name:dto.name.trim(),createdBy:staff.id,
      items:dto.items.map(item=>({
        title:item.title.trim(),weekday:item.weekday,time:item.time,notes:item.notes || '',
        ...(item.recipeId ? { recipeId:toId(item.recipeId) } : {}),
      })),createdAt:new Date(),
    });
    return { id:String(record.insertedId) };
  }

  @ApiSecurity('csrf')
  @Delete('plan-templates/:id')
  @UseGuards(CsrfGuard)
  async removeTemplate(@Req() req: Request, @Param('id') id: string) {
    const staff = await this.caller(req);
    const result = await this.db().collection('DietPlanTemplates').deleteOne({
      _id:toId(id),createdBy:staff.id,
    });
    if (!result.deletedCount) throw new NotFoundException('Template not found');
    return { ok:true };
  }

  private async writeDrafts(req: Request, patientId: string,
    proposed: { title: string; plannedAt: Date; notes?: string; recipeId?: Types.ObjectId; source?: string }[]) {
    const { id,staff } = await this.patient(req,patientId);
    if (proposed.length > 42) throw new BadRequestException('Maximum 42 entries per operation');
    const first = new Date(Math.min(...proposed.map(x=>x.plannedAt.getTime())));
    const last = new Date(Math.max(...proposed.map(x=>x.plannedAt.getTime())) + 1);
    const existing = await this.db().collection('DietPlans').find({
      patientId:id, plannedAt:{$gte:first,$lt:last},
    },{projection:{title:1,plannedAt:1}}).toArray();
    const keys = new Set(existing.map(x=>x.plannedAt.toISOString()+'|'+x.title.trim().toLowerCase()));
    const now = new Date();
    const unique = proposed.filter(item => {
      const key=item.plannedAt.toISOString()+'|'+item.title.trim().toLowerCase();
      if(keys.has(key)) return false;
      keys.add(key); return true;
    });
    if (unique.length) await this.db().collection('DietPlans').insertMany(unique.map(item=>({
      patientId:id, title:item.title.trim(), plannedAt:item.plannedAt,
      notes:item.notes || '',status:'draft', ...(item.recipeId?{recipeId:item.recipeId}:{}),
      source:item.source || 'manual', createdAt:now,updatedAt:now,createdBy:staff.id,
    })));
    return { created:unique.length, skipped:proposed.length-unique.length, status:'draft' };
  }

  @ApiSecurity('csrf')
  @Post('plans/apply-template')
  @UseGuards(CsrfGuard)
  async apply(@Req() req: Request, @Body() dto: ApplyPlanTemplateDto) {
    const staff = await this.caller(req);
    const template = await this.db().collection('DietPlanTemplates').findOne({
      _id:toId(dto.templateId),createdBy:staff.id,
    });
    if (!template) throw new NotFoundException('Template not found');
    const { first } = datesForWeek(dto.weekStart);
    const proposed = (template.items as PlanTemplateItemDto[]).map(item => {
      const [hours,minutes] = item.time.split(':').map(Number);
      return { title:item.title,notes:item.notes,recipeId:item.recipeId ? toId(String(item.recipeId)) : undefined,
        plannedAt:new Date(first.getTime()+item.weekday*MS_DAY+hours*3600000+minutes*60000),
        source:'template:'+String(template._id) };
    });
    return this.writeDrafts(req,dto.patientId,proposed);
  }

  @ApiSecurity('csrf')
  @Post('plans/duplicate-week')
  @UseGuards(CsrfGuard)
  async duplicate(@Req() req: Request, @Body() dto: DuplicatePlanWeekDto) {
    const { id } = await this.patient(req,dto.patientId);
    const source = datesForWeek(dto.sourceWeek), target = datesForWeek(dto.targetWeek);
    if (source.first.getTime() === target.first.getTime()) throw new BadRequestException('Choose different weeks');
    const records = await this.db().collection('DietPlans').find({
      patientId:id, plannedAt:{$gte:source.first,$lt:source.last},
    }).sort({plannedAt:1}).limit(43).toArray();
    if (records.length > 42) throw new BadRequestException('Source week has too many entries');
    const offset = target.first.getTime()-source.first.getTime();
    return this.writeDrafts(req,dto.patientId,records.map(x=>({
      title:x.title,notes:x.notes,recipeId:x.recipeId,
      plannedAt:new Date(x.plannedAt.getTime()+offset),source:'duplicate-week',
    })));
  }

  @ApiSecurity('csrf')
  @Post('plans/publish-week')
  @UseGuards(CsrfGuard)
  async publish(@Req() req: Request, @Body() dto: PublishPlanWeekDto) {
    const { id,staff } = await this.patient(req,dto.patientId);
    const { first,last } = datesForWeek(dto.weekStart);
    const result = await this.db().collection('DietPlans').updateMany({
      patientId:id,plannedAt:{$gte:first,$lt:last},status:'draft',
    },{ $set:{status:'published',updatedAt:new Date(),publishedBy:staff.id,publishedAt:new Date()} });
    return { published:result.modifiedCount };
  }

  @Get('plans/:id/history')
  async history(@Req() req: Request, @Param('id') id: string) {
    const current = await this.db().collection('DietPlans').findOne({_id:toId(id)});
    if (!current) throw new NotFoundException('Plan not found');
    await this.patient(req,String(current.patientId));
    const records = await this.db().collection('DietPlanRevisions').find({planId:current._id})
      .sort({createdAt:-1}).limit(50).toArray();
    return records.map(x=>({id:String(x._id),operation:x.operation,createdAt:x.createdAt,
      before:x.before,after:x.after}));
  }
}
