import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  InternalServerErrorException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { Express } from 'express'; // Import Express for type hinting

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 6)) // 'files' is the field name, 6 is max count
  async uploadImages(@UploadedFiles() files: Array<Express.Multer.File>) {
    if (!files || files.length === 0) {
      throw new InternalServerErrorException('No files uploaded.');
    }
    const fileUrls = await this.uploadsService.saveImages(files);
    return {
      message: 'Imágenes subidas exitosamente',
      urls: fileUrls,
    };
  }
}