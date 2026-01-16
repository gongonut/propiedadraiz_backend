import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { Property, PropertySchema } from './schemas/property.schema';
import { BotsModule } from '../bots/bots.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Property.name, schema: PropertySchema }]),
    BotsModule,
  ],
  controllers: [PropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService], // Exportamos el servicio si otros módulos necesitan interactuar con propiedades
})
export class PropertiesModule {}