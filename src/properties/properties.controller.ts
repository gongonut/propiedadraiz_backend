import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 6, {
      storage: diskStorage({
        destination: './public/uploads/properties',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  uploadImages(@UploadedFiles() files: Array<Express.Multer.File>) {
    return files.map((file) => ({
      originalName: file.originalname,
      filename: file.filename,
      url: `/uploads/properties/${file.filename}`,
    }));
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createPropertyDto: CreatePropertyDto, @Req() req) {
    const userId = createPropertyDto.user || req.user.userId;
    return this.propertiesService.create(createPropertyDto, userId);
  }

  @Get('redirect-wa/:code')
  async redirectWhatsapp(@Param('code') code: string, @Res() res: Response) {
    try {
      const url = await this.propertiesService.getWhatsAppRedirectUrl(code);
      return res.redirect(url);
    } catch (error) {
      // Si falla (ej: no hay bot), redirigir al frontend con error o al detalle
      // Por simplicidad, redirigimos a una página de error genérica o volvemos a localhost:4200
      return res.redirect(`http://localhost:4200/ver-inmueble/${code}?error=whatsapp_unavailable`);
    }
  }

  @Get()
  findAll() {
    return this.propertiesService.findAll();
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.propertiesService.findPropertiesByUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updatePropertyDto: UpdatePropertyDto) {
    return this.propertiesService.update(id, updatePropertyDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.propertiesService.remove(id);
  }
}