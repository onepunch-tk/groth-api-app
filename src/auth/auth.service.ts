import { HttpStatus, Injectable } from '@nestjs/common';
import { ISocialUser, Role } from './interfaces/social-user.interface';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { FastifyReply, FastifyRequest } from 'fastify';
import { TokenResponse } from './responses/token.response';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}
  async OAuthSignIn(
    socialUser: ISocialUser,
    res: FastifyReply,
  ): Promise<TokenResponse> {
    try {
      let userDoc = await this.userModel.findOne({
        username: socialUser.username,
      });
      if (!userDoc) {
        const adminUsername = this.configService.get<string>('ADMIN');
        userDoc = await this.userModel.create({
          ...socialUser,
          ...(adminUsername &&
            adminUsername === socialUser.username && { role: Role.ADMIN }),
        });
      }

      const { accessToken, refreshToken } = await this.generateJwtToken(
        userDoc.username,
        userDoc.id,
      );

      res.setCookie('refreshToken', refreshToken, {
        secure: false,
        path: '/',
        httpOnly: true,
      });

      return {
        statusCode: HttpStatus.OK,
        accessToken,
      };
    } catch (e) {
      return {
        statusCode: HttpStatus.UNAUTHORIZED,
      };
    }
  }

  async refreshTokens(req: FastifyRequest, reply: FastifyReply) {
    const REFRESH_TOKEN = 'refreshToken';
    const refreshToken = req.cookies[REFRESH_TOKEN];
    if (!refreshToken) {
      return { statusCode: HttpStatus.UNAUTHORIZED };
    }

    try {
      const decoded = await this.jwtService.verify(refreshToken);
      const { username, id } = decoded;
      const tokens = await this.generateJwtToken(username, id);

      reply.setCookie(REFRESH_TOKEN, tokens.refreshToken, {
        httpOnly: true,
        path: '/',
      });
      return { statusCode: HttpStatus.OK, accessToken: tokens.accessToken };
    } catch (e) {
      reply.clearCookie(REFRESH_TOKEN, {
        httpOnly: true,
        path: '/',
      });
      return { statusCode: HttpStatus.UNAUTHORIZED };
    }
  }

  private async generateJwtToken(username: string, id: string) {
    const payload = { username, id };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '2m' }), // refreshToken 만료 시간 설정
    };
  }
}
