import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
} from 'class-validator';

export class CreateUserDto {
  @IsEnum(['NATURAL', 'EMPRESA'])
  @IsOptional()
  readonly tipoPersona?: 'NATURAL' | 'EMPRESA';

  @IsString()
  @IsOptional()
  readonly nit?: string;

  @IsString()
  @IsOptional()
  readonly empresa?: string;

  @IsString()
  @IsNotEmpty()
  readonly nombre: string;

  @IsString()
  @IsNotEmpty()
  readonly telefono: string;

  @IsString()
  @IsNotEmpty()
  readonly whatsapp: string;

  @IsEmail()
  readonly correo: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  readonly password: string;
}