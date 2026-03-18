import { IsString, MinLength, MaxLength, IsEmail, IsOptional, IsIn } from 'class-validator';

export class SignupDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsIn(['male', 'female', 'other'])
  gender: 'male' | 'female' | 'other';

  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;
}
