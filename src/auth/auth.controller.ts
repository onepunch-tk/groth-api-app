import {
  Controller,
  Get,
  Redirect,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ISocialUser } from './interfaces/social-user.interface';
import { SocialUser } from './decorators/social-user.decorator';
import { FastifyReply, FastifyRequest } from 'fastify';
import { KakaoAuthGuard } from './guards/kakao-auth.guard';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokenResponse } from './dto/responses/token.response';
import { UnauthorizedExceptionFilter } from './filters/unauthorized-exception.filter';

@Controller('auth')
@UseFilters(UnauthorizedExceptionFilter)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}
  // @UseGuards(KakaoAuthGuard)
  @Get('kakao')
  @Redirect()
  async signInKakao() {
    const clientId = this.configService.get('KAKAO_CLIENT_ID');
    const redirectUri = this.configService.get('KAKAO_CALLBACK_URL');
    const kakaoAuthUrl = `https://kauth.kakao.cogit m/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
    return { url: kakaoAuthUrl, statusCode: 302 };
  }
  @UseGuards(KakaoAuthGuard)
  @Get('kakao/callback')
  async kakaoCallback(
    @SocialUser() socialUser: ISocialUser,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<TokenResponse> {
    return this.authService.OAuthSignIn(socialUser, res);
  }

  @Get('refresh')
  async refreshTokens(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.authService.refreshTokens(req, reply);
  }

  @UseGuards(JwtAuthGuard)
  @Get('protected')
  async hello() {
    return 'hello world';
  }
}
