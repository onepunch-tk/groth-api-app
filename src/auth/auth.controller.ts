import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { ISocialUser } from './interfaces/social-user.interface';
import { SocialUser } from './decorators/social-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @UseGuards(AuthGuard('kakao'))
  @Get('kakao')
  async signInKakao() {
    return;
  }
  @UseGuards(AuthGuard('kakao'))
  @Get('kakao/callback')
  async kakaoCallback(
    @SocialUser() socialUser: ISocialUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.OAuthSignIn(socialUser);
    return res.json();
  }
}
