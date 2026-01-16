import { Module, forwardRef } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { LeadsModule } from '../leads/leads.module';
import { PropertiesModule } from '../properties/properties.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    forwardRef(() => LeadsModule),
    forwardRef(() => PropertiesModule),
    forwardRef(() => WhatsappModule)
  ],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
