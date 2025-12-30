import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type PropertyDocument = Property & Document;

@Schema()
class Geolocation {
  @Prop({ required: true })
  lat: number;

  @Prop({ required: true })
  lon: number;
}

export const GeolocationSchema = SchemaFactory.createForClass(Geolocation);

@Schema({ timestamps: true })
export class Property {
  @Prop({ required: true, unique: true, index: true, trim: true })
  code: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  user: User | mongoose.Types.ObjectId;

  @Prop({ trim: true })
  nombreEdificio: string;

  @Prop({ type: GeolocationSchema, required: true })
  geolocalizacion: Geolocation;

  @Prop({ required: true, trim: true })
  direccion: string;

  @Prop({ required: true, trim: true })
  ciudad: string;

  @Prop({ required: true, trim: true })
  departamento: string;

  @Prop({ required: true, trim: true })
  descripcion: string;

  @Prop({ required: true, enum: ['Venta', 'Alquiler', 'Ambos'] })
  tipoTransaccion: string;

  @Prop()
  piso: number;

  @Prop({ required: true })
  area: number;

  @Prop({ required: true })
  habitaciones: number;

  @Prop({ required: true })
  banos: number;

  @Prop()
  garajes: number;

  @Prop({ required: true })
  precio: number;

  @Prop({ trim: true })
  telefonoContacto: string;

  @Prop()
  qrCode: string;

  @Prop({ type: [String], validate: [v => Array.isArray(v) && v.length <= 6, 'La galería no puede tener más de 6 fotos'] })
  fotos: string[];
}

export const PropertySchema = SchemaFactory.createForClass(Property);