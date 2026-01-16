import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lead, LeadDocument } from './schemas/lead.schema';
import { CreateLeadDto } from './dto/create-lead.dto';
import { PropertiesService } from '../properties/properties.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { BotsService } from '../bots/bots.service';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @Inject(forwardRef(() => PropertiesService))
    private readonly propertiesService: PropertiesService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
    @Inject(forwardRef(() => BotsService))
    private readonly botsService: BotsService,
  ) {}

  async create(createLeadDto: CreateLeadDto): Promise<Lead> {
    const { propertyCode, name, whatsapp } = createLeadDto;
    
    // 1. Validar propiedad
    const property = await this.propertiesService.findByCode(propertyCode);
    if (!property) {
      throw new NotFoundException('Propiedad no encontrada');
    }

    // 2. Guardar Lead
    const createdLead = new this.leadModel(createLeadDto);
    const savedLead = await createdLead.save();

    // 3. Activar Bot para enviar info
    await this.sendPropertyInfoToLead(savedLead, property);

    return savedLead;
  }

  async findAll(): Promise<Lead[]> {
    return this.leadModel.find().exec();
  }

  private async sendPropertyInfoToLead(lead: LeadDocument, property: any) {
    try {
      // Buscar un bot activo para enviar el mensaje
      const activeBots = await this.botsService.findAllActive();
      if (activeBots.length === 0) {
        this.logger.warn('No hay bots activos para enviar información al lead.');
        return;
      }
      const botSessionId = activeBots[0].sessionId;

      // Construir mensaje
      // El agente es property.user
      const agentName = property.user?.name || 'Agente';
      const agentPhone = property.user?.whatsapp || property.user?.telefono;
      
      let message = `Hola *${lead.name}*, gracias por tu interés en: *${property.nombreEdificio || property.direccion}*.\n\n`;
      message += `💰 *Precio:* $${property.precio}\n`;
      message += `📍 *Ubicación:* ${property.ciudad}, ${property.direccion}\n`;
      message += `🛏 *Habitaciones:* ${property.habitaciones} | 🚿 *Baños:* ${property.banos} | 📏 *Área:* ${property.area}m²\n\n`;
      message += `📝 *Descripción:* ${property.descripcion}\n\n`;
      
      if (agentPhone) {
        message += `📞 Contacta directamente a *${agentName}* aquí: https://wa.me/${agentPhone.replace('+', '')}\n`;
      }

      // Enviar Mensaje de Texto
      await this.whatsappService.sendMessage(botSessionId, lead.whatsapp, message);

      // Enviar Foto Principal (si existe)
      if (property.fotos && property.fotos.length > 0) {
        // Asumiendo que las fotos son URLs o paths accesibles. 
        // Si son locales, el WhatsappService necesitaría manejar uploads o el path absoluto.
        // Por ahora enviamos la primera foto.
        const photoUrl = property.fotos[0];
        // Validar si es URL completa o path relativo
        // Esto depende de cómo se guarden. Asumiremos URL o string válido.
        try {
             await this.whatsappService.sendImageMessage(botSessionId, lead.whatsapp, photoUrl, property.nombreEdificio || 'Foto del Inmueble');
        } catch (imgError) {
             this.logger.error(`Error enviando imagen: ${imgError.message}`);
        }
      }

      // Actualizar estado de contacto
      lead.contacted = true;
      await lead.save();

    } catch (error) {
      this.logger.error(`Error enviando info de WhatsApp al lead: ${error.message}`, error.stack);
    }
  }
}
