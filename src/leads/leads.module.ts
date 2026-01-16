import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { Lead, LeadSchema } from './schemas/lead.schema';
import { PropertiesModule } from '../properties/properties.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { BotsModule } from '../bots/bots.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }]),
    forwardRef(() => PropertiesModule),
    forwardRef(() => WhatsappModule),
    forwardRef(() => BotsModule)
  ],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
