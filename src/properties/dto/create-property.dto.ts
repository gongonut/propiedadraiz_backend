import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsPositive,
  ValidateNested,
  IsArray,
  ArrayMaxSize,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GeolocationDto } from './geolocation.dto';

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  readonly code?: string;

  @IsString()
  @IsOptional()
  readonly user?: string;

  @IsString()
  @IsOptional()
  readonly nombreEdificio?: string;

  @ValidateNested()
  @Type(() => GeolocationDto)
  @IsNotEmpty()
  readonly geolocalizacion: GeolocationDto;

  @IsString()
  @IsNotEmpty()
  readonly direccion: string;

  @IsString()
  @IsNotEmpty()
  readonly ciudad: string;

  @IsString()
  @IsNotEmpty()
  readonly departamento: string;

  @IsString()
  @IsNotEmpty()
  readonly descripcion: string;

  @IsEnum(['Venta', 'Alquiler', 'Ambos'])
  readonly tipoTransaccion: 'Venta' | 'Alquiler' | 'Ambos';

  @IsEnum(['Disponible', 'Vendido', 'Arrendado', 'Inactivo'])
  @IsOptional()
  readonly estado?: 'Disponible' | 'Vendido' | 'Arrendado' | 'Inactivo';

  @IsNumber()
  @IsOptional()
  readonly piso?: number;

  @IsNumber()
  @IsPositive()
  readonly area: number;

  @IsNumber()
  @IsPositive()
  readonly habitaciones: number;

  @IsNumber()
  @IsPositive()
  readonly banos: number;

  @IsNumber()
  @IsOptional()
  readonly garajes?: number;

  @IsNumber()
  @IsPositive()
  readonly precio: number;

  @IsString()
  @IsOptional()
  readonly telefonoContacto?: string;

  // Las URLs de las fotos se añadirán en el servicio después de subirlas.
  // Se usa IsString en lugar de IsUrl para permitir rutas relativas internas (/uploads/...)
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @IsOptional()
  readonly fotos?: string[];
}