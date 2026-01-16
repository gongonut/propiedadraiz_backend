import { Controller, Get, Post, Put, Body, Param, Delete, Patch } from '@nestjs/common';
import { BotsService } from './bots.service';
import { Bot, BotDocument } from './schemas/bot.schema';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

class CreateBotDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  empresaId?: string;
}

class UpdateBotDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  empresaId?: string;
}

@Controller('bots')
export class BotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Post()
  async create(@Body() createBotDto: CreateBotDto): Promise<BotDocument> {
    const empresaId = createBotDto.empresaId ? createBotDto.empresaId : undefined;
    const bot = await this.botsService.create(createBotDto.name, empresaId);
    
    // Attempt to start the bot session asynchronously so it doesn't block the creation response
    this.whatsappService.startBotSession(bot).catch(error => {
      console.error(`Failed to start bot session for ${bot.name}: ${error.message}`);
    });

    return bot;
  }

  @Get()
  findAll(): Promise<BotDocument[]> {
    return this.botsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<BotDocument> {
    return this.botsService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateBotDto: UpdateBotDto): Promise<BotDocument> {
    const updates: any = { ...updateBotDto };
    if (updates.empresaId === '') {
      updates.empresa = undefined; // Unset or set to undefined
      delete updates.empresaId;
    } else if (updates.empresaId) {
      updates.empresa = updates.empresaId;
      delete updates.empresaId;
    }
    return this.botsService.update(id, updates);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<any> {
    const bot = await this.botsService.findOne(id);
    if (bot) {
      await this.whatsappService.stopBotSession(bot.sessionId);
    }
    return this.botsService.delete(id);
  }

  @Patch(':id/activate')
  async activate(@Param('id') id: string): Promise<BotDocument> {
    const bot = await this.botsService.findOne(id);
    if (bot) {
      await this.whatsappService.startBotSession(bot);
    }
    return this.botsService.findOne(id);
  }

  @Patch(':id/inactivate')
  async inactivate(@Param('id') id: string): Promise<BotDocument> {
    const bot = await this.botsService.findOne(id);
    if (bot) {
      await this.whatsappService.stopBotSession(bot.sessionId);
      return this.botsService.update(id, { status: 'inactive' });
    }
    return bot;
  }
}
