import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as qrcode from 'qrcode'; // Add this line

import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { Property, PropertyDocument } from './schemas/property.schema';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Property.name) private propertyModel: Model<PropertyDocument>,
  ) {}

  async create(createPropertyDto: CreatePropertyDto, userId: string): Promise<Property> {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const qrUrl = `http://localhost:4200/ver-inmueble/${code}`;
    const qrCodeImage = await qrcode.toDataURL(qrUrl);

    const createdProperty = new this.propertyModel({
      ...createPropertyDto,
      code,
      qrCode: qrCodeImage,
      user: userId, // Asociar la propiedad con el usuario
    });
    return createdProperty.save();
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
    const result = await this.propertyModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Propiedad con ID "${id}" no encontrada`);
    }
    return { message: `Propiedad con ID "${id}" eliminada correctamente` };
  }

  // Método adicional para encontrar propiedades por un usuario específico
  async findPropertiesByUser(userId: string): Promise<Property[]> {
    return this.propertyModel.find({ user: new Types.ObjectId(userId) }).populate('user', '-password').exec();
  }
}