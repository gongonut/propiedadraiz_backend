import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';

// Nota: No usamos AuthGuard en el POST porque es público para quien escanea el QR
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  create(@Body() createLeadDto: CreateLeadDto) {
    return this.leadsService.create(createLeadDto);
  }

  // Solo administradores o usuarios autenticados deberían ver los leads
  // Por ahora lo dejo abierto o podrías descomentar el AuthGuard si ya tienes roles
  // @UseGuards(JwtAuthGuard) 
  @Get()
  findAll() {
    return this.leadsService.findAll();
  }
}
