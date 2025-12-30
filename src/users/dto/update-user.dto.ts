import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// UpdateUserDto extiende CreateUserDto, pero hace todos los campos opcionales
// y omite el campo 'password' para que no se pueda actualizar por esta vía.
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {}