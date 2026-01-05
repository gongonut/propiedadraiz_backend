import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';
import { CreatePropertyDto } from '../../properties/dto/create-property.dto';

export class CreateClientWithPropertiesDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CreateUserDto)
  readonly userData: CreateUserDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePropertyDto)
  readonly properties: CreatePropertyDto[];
}