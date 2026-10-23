import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsMongoId, IsOptional, IsString,
  Matches, Max, MaxLength, Min, MinLength, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class PlanTemplateItemDto {
  @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsInt() @Min(0) @Max(6) weekday!: number; // Monday = 0; Sunday = 6
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) time!: string; // UTC HH:mm
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsMongoId() recipeId?: string;
}
export class CreatePlanTemplateDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(28) @ValidateNested({ each:true })
  @Type(() => PlanTemplateItemDto) items!: PlanTemplateItemDto[];
}
export class ApplyPlanTemplateDto {
  @IsMongoId() patientId!: string;
  @IsMongoId() templateId!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) weekStart!: string; // UTC Monday
}
export class DuplicatePlanWeekDto {
  @IsMongoId() patientId!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) sourceWeek!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) targetWeek!: string;
}
export class PublishPlanWeekDto {
  @IsMongoId() patientId!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) weekStart!: string;
}
