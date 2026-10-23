import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  @ApiProperty({})
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  @ApiProperty({})
  password!: string;
}

/** One-time patient invitation activation. */
export class ActivatePatientDto {
  @IsString()
  @MinLength(40)
  @MaxLength(128)
  @ApiProperty({})
  token!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @ApiProperty({})
  password!: string;
}
