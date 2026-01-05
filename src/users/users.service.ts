import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';
import { CreateClientWithPropertiesDto } from './dto/create-client-with-properties.dto';
import { PropertiesService } from '../properties/properties.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private propertiesService: PropertiesService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const createdUser = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
    });
    return createdUser.save();
  }

  async createWithProperties(createClientDto: CreateClientWithPropertiesDto): Promise<{ user: User; properties: any[] }> {
    // 1. Crear el usuario
    const user = await this.create(createClientDto.userData);

    // 2. Crear las propiedades asociadas al usuario
    const createdProperties = [];
    for (const propertyDto of createClientDto.properties) {
      // Asignar el ID del usuario recién creado a la propiedad.
      // La propiedad espera el campo `user` con el ID.
      const propertyWithUser = { ...propertyDto, user: user._id.toString() };
      const property = await this.propertiesService.create(propertyWithUser, user._id.toString());
      createdProperties.push(property);
    }

    return { user, properties: createdProperties };
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().select('-password').exec();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userModel.findById(id).select('-password').exec();
    if (!user) {
      throw new NotFoundException(`Usuario con ID "${id}" no encontrado`);
    }
    return user;
  }

  // Este método será útil para el módulo de autenticación
  async findOneByEmail(email: string): Promise<User | undefined> {
    return this.userModel.findOne({ correo: email }).exec();
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .select('-password')
      .exec();
    if (!updatedUser) {
      throw new NotFoundException(`Usuario con ID "${id}" no encontrado`);
    }
    return updatedUser;
  }

  async remove(id: string) {
    // 1. Eliminar propiedades asociadas al usuario
    await this.propertiesService.removePropertiesByUser(id);

    // 2. Eliminar el usuario
    const result = await this.userModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Usuario con ID "${id}" no encontrado`);
    }
    return { message: `Usuario con ID "${id}" y sus propiedades asociadas eliminados correctamente` };
  }
}