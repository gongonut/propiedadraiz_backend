import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import * as qrcode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

import { BotsService } from '../bots/bots.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { Property, PropertyDocument } from './schemas/property.schema';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
    private readonly botsService: BotsService,
    private readonly configService: ConfigService,
  ) {}

  async create(createPropertyDto: CreatePropertyDto, userId: string): Promise<Property> {
    const code = createPropertyDto.code || Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Generar QR que apunta al endpoint de redirección del backend
    // Usamos la variable de entorno BACKEND_URL o default a localhost:3000
    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:3000';
    const qrUrl = `${backendUrl}/properties/redirect-wa/${code}`;
    
    const qrCodeImage = await qrcode.toDataURL(qrUrl);

    const createdProperty = new this.propertyModel({
      ...createPropertyDto,
      code,
      qrCode: qrCodeImage,
      user: userId, // Asociar la propiedad con el usuario
    });
    return createdProperty.save();
  }

  async getWhatsAppRedirectUrl(code: string): Promise<string> {
    // 1. Verificar que la propiedad existe
    const property = await this.findByCode(code);
    
    // 2. Buscar un bot activo
    const activeBots = await this.botsService.findAllActive();
    if (!activeBots || activeBots.length === 0) {
      // Si no hay bot, redirigir a una página de error o al detalle web normal
      // Por ahora, lanzamos excepción o retornamos null
      throw new NotFoundException('No hay bots de WhatsApp activos en este momento.');
    }
    
    // Usar el primer bot activo
    const bot = activeBots[0];
    const botPhone = bot.phoneNumber; // El número del bot (ej: 57300...)

    if (!botPhone) {
        throw new NotFoundException('El bot activo no tiene un número de teléfono configurado.');
    }

    // 3. Construir URL de WhatsApp
    // https://wa.me/<NUMBER>?text=<MESSAGE>
    const text = `Hola, me interesa el inmueble ${code}`;
    const encodedText = encodeURIComponent(text);
    
    return `https://wa.me/${botPhone}?text=${encodedText}`;
  }

  async findAll(): Promise<Property[]> {
    // Populate 'user' para obtener los detalles del usuario, excluyendo la contraseña
    return this.propertyModel.find().populate('user', '-password').exec();
  }

  async findOne(id: string): Promise<Property> {
    const property = await this.propertyModel.findById(id).populate('user', '-password').exec();
    if (!property) {
      throw new NotFoundException(`Propiedad con ID "${id}" no encontrada`);
    }
    return property;
  }

  async findByCode(code: string): Promise<Property> {
    const property = await this.propertyModel.findOne({ code }).populate('user', '-password').exec();
    if (!property) {
      throw new NotFoundException(`Propiedad con código "${code}" no encontrada`);
    }
    return property;
  }

  async update(id: string, updatePropertyDto: UpdatePropertyDto): Promise<Property> {
    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, updatePropertyDto, { new: true })
      .populate('user', '-password')
      .exec();
    if (!updatedProperty) {
      throw new NotFoundException(`Propiedad con ID "${id}" no encontrada`);
    }
    return updatedProperty;
  }

  async remove(id: string) {
    const property = await this.propertyModel.findById(id).exec();
    if (!property) {
      throw new NotFoundException(`Propiedad con ID "${id}" no encontrada`);
    }

    // Eliminar fotos asociadas
    if (property.fotos && property.fotos.length > 0) {
      property.fotos.forEach(fotoUrl => this.deleteImage(fotoUrl));
    }

    const result = await this.propertyModel.deleteOne({ _id: id }).exec();
    return { message: `Propiedad con ID "${id}" eliminada correctamente` };
  }

  // Método adicional para encontrar propiedades por un usuario específico
  async findPropertiesByUser(userId: string): Promise<Property[]> {
    return this.propertyModel.find({ user: new Types.ObjectId(userId) }).populate('user', '-password').exec();
  }

  async removePropertiesByUser(userId: string) {
    const properties = await this.propertyModel.find({ user: new Types.ObjectId(userId) }).exec();
    
    // Eliminar fotos de todas las propiedades del usuario
    for (const property of properties) {
      if (property.fotos && property.fotos.length > 0) {
        property.fotos.forEach(fotoUrl => this.deleteImage(fotoUrl));
      }
    }

    return this.propertyModel.deleteMany({ user: new Types.ObjectId(userId) }).exec();
  }

  private deleteImage(url: string) {
    try {
      // url format: /uploads/properties/filename.ext
      // file path: public/uploads/properties/filename.ext
      // remove leading slash if present
      const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
      const filePath = path.join(process.cwd(), 'public', cleanUrl);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted file: ${filePath}`);
      } else {
        console.warn(`File not found for deletion: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error deleting file ${url}:`, error);
    }
  }
}