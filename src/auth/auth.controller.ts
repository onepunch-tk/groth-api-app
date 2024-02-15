import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  @UseGuards(AuthGuard('kakao'))
  @Get('kakao')
  async signInKakao() {
    return;
  }
  @UseGuards(AuthGuard('kakao'))
  @Get('kakao/callback')
  async kakaoCallback() {
    return;
  }
}
