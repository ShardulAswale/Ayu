import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsDateString, IsIn, IsInt, MinLength, IsMongoId, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class FoodEntryDto {
  @ApiProperty({}) @IsString() @MaxLength(160) foodName!: string;
  @ApiProperty({}) @IsDateString() eatenAt!: string;
  @ApiProperty({ type: Number }) @IsNumber() @Min(0.01) @Max(100000) quantity!: number;
  @ApiProperty({}) @IsString() @MaxLength(36) unit!: string;
  @ApiPropertyOptional({}) @IsOptional() @IsMongoId() recipeId?: string;
  @ApiPropertyOptional({}) @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
export class RecipeDto {
  @ApiProperty({}) @IsString() @MaxLength(160) name!: string;
  @ApiProperty({}) @IsString() @MaxLength(5000) ingredients!: string;
  @ApiProperty({ type: Number }) @IsNumber() @Min(0) @Max(100000) calories!: number;
  @ApiProperty({ type: Number }) @IsNumber() @Min(0) @Max(10000) protein!: number;
  @ApiProperty({ type: Number }) @IsNumber() @Min(0) @Max(10000) carbs!: number;
  @ApiProperty({ type: Number }) @IsNumber() @Min(0) @Max(10000) fat!: number;
  @ApiProperty({ type: Number }) @IsNumber() @Min(0) @Max(10000) fiber!: number;
  @ApiPropertyOptional({}) @IsOptional() @IsString() @MaxLength(500) allergens?: string;
  @ApiPropertyOptional({}) @IsOptional() @IsString() @MaxLength(400) source?: string;
  @ApiPropertyOptional({}) @IsOptional() @IsString() @MaxLength(3000) instructions?: string;
}
export class PlanEntryDto {
  @ApiProperty({}) @IsMongoId() patientId!: string;
  @ApiProperty({}) @IsString() @MaxLength(160) title!: string;
  @ApiProperty({}) @IsDateString() plannedAt!: string;
  @ApiPropertyOptional({}) @IsOptional() @IsMongoId() recipeId?: string;
  @ApiPropertyOptional({}) @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @ApiProperty({ enum: ['draft', 'published'] }) @IsIn(['draft', 'published']) status!: 'draft' | 'published';
}
export class PlanEditDto {
  @ApiPropertyOptional({}) @IsOptional() @IsString() @MaxLength(160) title?: string;
  @ApiPropertyOptional({}) @IsOptional() @IsDateString() plannedAt?: string;
  @ApiPropertyOptional({}) @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @ApiPropertyOptional({ enum: ['draft', 'published'] }) @IsOptional() @IsIn(['draft', 'published']) status?: 'draft' | 'published';
}
export class AppointmentDto {
  @ApiProperty({}) @IsMongoId() patientId!: string;
  @ApiProperty({}) @IsMongoId() dietitianId!: string;
  @ApiProperty({}) @IsDateString() startsAt!: string;
  @ApiProperty({}) @IsString() @MaxLength(160) title!: string;
  @ApiProperty({ type: Number }) @IsInt() @Min(15) @Max(240) durationMinutes!: number;
}
export class AssignmentDto {
  @ApiProperty({}) @IsMongoId() patientId!: string;
  @ApiProperty({}) @IsMongoId() dietitianId!: string;
}
export class LayoutDto {
  @IsArray() @IsString({ each: true }) @MaxLength(64, { each: true })
  @ApiProperty({ type: [String] })
  widgets!: string[];
}
export class ProgressDto {
  @ApiProperty({}) @IsDateString() measuredAt!: string;
  @ApiProperty({}) @IsString() @MaxLength(90) metric!: string;
  @ApiProperty({ type: Number }) @IsNumber() @Min(-1000000) @Max(1000000) value!: number;
  @ApiProperty({}) @IsString() @MaxLength(20) unit!: string;
}

export class CreatePatientDto {
  @ApiProperty({}) @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty({}) @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
export class PatientStatusDto {
  @ApiProperty({ type: Boolean }) @IsBoolean() active!: boolean;
}
