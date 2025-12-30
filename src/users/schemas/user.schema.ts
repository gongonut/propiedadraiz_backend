import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ trim: true })
  empresa: string;

  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ required: true, trim: true })
  telefono: string;

  @Prop({ required: true, trim: true })
  whatsapp: string;

  @Prop({
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true,
  })
  correo: string;

  @Prop({ required: true })
  password: string;

  // Futuros campos
  // @Prop({ default: true })
  // isActive: boolean;

  // @Prop([String])
  // roles: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);