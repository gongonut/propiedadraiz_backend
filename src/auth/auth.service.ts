import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async login(loginDto: LoginDto) {
    const { correo, password } = loginDto;
    
    // 1. Buscar usuario
    const user: any = await this.usersService.findOneByEmail(correo);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 2. Validar password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3. Generar JWT
    const payload = { username: user.correo, sub: user._id };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        _id: user._id,
        nombre: user.nombre,
        correo: user.correo,
        role: user.role // Si tienes roles
      }
    };
  }
}
