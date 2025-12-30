import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Express } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UploadsService {
  private readonly uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'properties');

  constructor() {
    // Ensure the upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveImages(files: Array<Express.Multer.File>): Promise<string[]> {
    const fileUrls: string[] = [];

    for (const file of files) {
      const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
      const filePath = path.join(this.uploadDir, uniqueFilename);

      try {
        await fs.promises.writeFile(filePath, file.buffer);
        // Assuming the NestJS app runs on port 3000 and serves static files from /public
        const fileUrl = `/uploads/properties/${uniqueFilename}`; // Relative URL for frontend
        fileUrls.push(fileUrl);
      } catch (error) {
        console.error(`Error saving file ${file.originalname}:`, error);
        throw new InternalServerErrorException(`Failed to save image: ${file.originalname}`);
      }
    }
    return fileUrls;
  }
}