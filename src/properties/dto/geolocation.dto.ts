import { IsLatitude, IsLongitude, IsNotEmpty } from 'class-validator';

export class GeolocationDto {
  @IsLatitude()
  @IsNotEmpty()
  lat: number;

  @IsLongitude()
  @IsNotEmpty()
  lon: number;
}