import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LeadDocument = Lead & Document;

@Schema({ timestamps: true })
export class Lead {
  @Prop({ required: false, default: 'Usuario WhatsApp' })
  name: string;

  @Prop({ required: true })
  whatsapp: string;

  @Prop()
  email: string;

  @Prop({ required: true })
  propertyCode: string; // Código único de la propiedad

  @Prop({ default: false })
  contacted: boolean; // Si el bot ya le escribió
}

export const LeadSchema = SchemaFactory.createForClass(Lead);