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
