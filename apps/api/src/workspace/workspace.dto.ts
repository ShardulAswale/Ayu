import { IsArray, IsDateString, IsIn, IsInt, IsMongoId, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class FoodEntryDto {
  @IsString() @MaxLength(160) foodName!: string;
  @IsDateString() eatenAt!: string;
  @IsNumber() @Min(0.01) @Max(100000) quantity!: number;
  @IsString() @MaxLength(36) unit!: string;
  @IsOptional() @IsMongoId() recipeId?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
export class RecipeDto {
  @IsString() @MaxLength(160) name!: string;
  @IsString() @MaxLength(5000) ingredients!: string;
  @IsNumber() @Min(0) @Max(100000) calories!: number;
  @IsNumber() @Min(0) @Max(10000) protein!: number;
  @IsNumber() @Min(0) @Max(10000) carbs!: number;
  @IsNumber() @Min(0) @Max(10000) fat!: number;
  @IsNumber() @Min(0) @Max(10000) fiber!: number;
  @IsOptional() @IsString() @MaxLength(500) allergens?: string;
  @IsOptional() @IsString() @MaxLength(400) source?: string;
  @IsOptional() @IsString() @MaxLength(3000) instructions?: string;
}
export class PlanEntryDto {
  @IsMongoId() patientId!: string;
  @IsString() @MaxLength(160) title!: string;
  @IsDateString() plannedAt!: string;
  @IsOptional() @IsMongoId() recipeId?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsIn(['draft', 'published']) status!: 'draft' | 'published';
}
export class PlanEditDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsDateString() plannedAt?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsIn(['draft', 'published']) status?: 'draft' | 'published';
}
export class AppointmentDto {
  @IsMongoId() patientId!: string;
  @IsMongoId() dietitianId!: string;
  @IsDateString() startsAt!: string;
  @IsString() @MaxLength(160) title!: string;
  @IsInt() @Min(15) @Max(240) durationMinutes!: number;
}
export class AssignmentDto {
  @IsMongoId() patientId!: string;
  @IsMongoId() dietitianId!: string;
}
export class LayoutDto {
  @IsArray() @IsString({ each: true }) @MaxLength(64, { each: true })
  widgets!: string[];
}
export class ProgressDto {
  @IsDateString() measuredAt!: string;
  @IsString() @MaxLength(90) metric!: string;
  @IsNumber() @Min(-1000000) @Max(1000000) value!: number;
  @IsString() @MaxLength(20) unit!: string;
}
