import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { LeadsService } from '../leads/leads.service';
import { GenericMessage } from '../whatsapp/providers/whatsapp-provider.interface';
import { PropertiesService } from '../properties/properties.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @Inject(forwardRef(() => LeadsService))
    private readonly leadsService: LeadsService,
    @Inject(forwardRef(() => PropertiesService))
    private readonly propertiesService: PropertiesService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
  ) {}

  async handleIncomingMessage(message: GenericMessage) {
    this.logger.log(`Processing incoming message from ${message.from}: ${message.text}`);

    if (!message.text) return;

    // Regex to detect "Hola, me interesa el inmueble CODE"
    const interestRegex = /me interesa el inmueble\s+([A-Z0-9-]+)/i; // Modified to include hyphen in code if needed
    const match = message.text.match(interestRegex);

    if (match) {
      const propertyCode = match[1];
      this.logger.log(`Interest detected for property code: ${propertyCode}`);

      // 1. Create/Update Lead
      const leadDto = {
        name: message.name || 'Usuario WhatsApp', 
        whatsapp: message.from.replace('@c.us', '').replace('@s.whatsapp.net', ''),
        propertyCode: propertyCode,
        email: '', 
      };

      try {
        await this.leadsService.create(leadDto);
        this.logger.log(`Lead created/processed for ${leadDto.whatsapp} and property ${propertyCode}`);
      } catch (error) {
        this.logger.error(`Error processing lead creation: ${error.message}`);
      }

      // 2. Fetch Property Details and Respond
      try {
        const property = await this.propertiesService.findByCode(propertyCode);
        
        // Construct Property Description
        const title = property.nombreEdificio || property.direccion;
        const price = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(property.precio);
        const transactionType = property.tipoTransaccion === 'Ambos' ? 'Venta / Alquiler' : property.tipoTransaccion;
        
        const responseText = `🏠 *${title}*\n` +
                             `📍 ${property.ciudad}, ${property.departamento}\n` +
                             `💰 *${price}* (${transactionType})\n\n` +
                             `✨ *Características:*\n` +
                             `- Área: ${property.area} m²\n` +
                             `- Habitaciones: ${property.habitaciones}\n` +
                             `- Baños: ${property.banos}\n` +
                             (property.garajes ? `- Garajes: ${property.garajes}\n` : '') +
                             `\n📝 ${property.descripcion}\n\n` +
                             `¿Te gustaría ver más fotos o agendar una visita?`;

        // Send Text Info
        await this.whatsappService.sendMessage(message.sessionId, message.from, responseText);

        // Send Main Image (if available)
        if (property.fotos && property.fotos.length > 0) {
          try {
             await this.whatsappService.sendImageMessage(
                message.sessionId, 
                message.from, 
                property.fotos[0], 
                'Foto Principal'
             );
          } catch (imgError) {
             this.logger.error(`Error sending property image: ${imgError.message}`);
          }
        }

        // Send Options (Text menu as buttons can be unreliable depending on provider version/mode)
        const menuText = `👇 *Opciones Disponibles:*\n\n` +
                         `1️⃣ Ver más fotos\n` +
                         `2️⃣ Agendar visita\n` +
                         `3️⃣ Hablar con un asesor\n\n` +
                         `_Responde con el número de tu elección._`;
        
        await this.whatsappService.sendMessage(message.sessionId, message.from, menuText);

      } catch (error) {
        this.logger.error(`Error fetching property or sending response: ${error.message}`);
        // Fallback message if property not found or error
        await this.whatsappService.sendMessage(message.sessionId, message.from, `¡Hola! Gracias por tu interés. Hemos registrado tu solicitud sobre el inmueble *${propertyCode}* y un asesor te contactará pronto con todos los detalles.`);
      }
    }
  }
}
