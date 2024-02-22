import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-custom';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Social } from '../interfaces/social-user.interface';

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async validate(request: any): Promise<any> {
    const code = request.query.code;
    if (!code) {
      throw new UnauthorizedException('No code provided');
    }
    try {
      const clientId = this.configService.get('KAKAO_CLIENT_ID');
      const clientSecret = this.configService.get('KAKAO_CLIENT_SECRET'); // 필요에 따라
      const redirectUri = this.configService.get('KAKAO_CALLBACK_URL');

      const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          redirect_uri: redirectUri,
          code,
          client_secret: clientSecret, // 필요에 따라
        }),
      });

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      const profileResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const profileData = await profileResponse.json();

      return {
        password: profileData.id,
        nickname: profileData.properties.nickname,
        username: profileData.kakao_account.email,
        social: Social.KAKAO,
      }; // NestJS가 request.user로 사용할 수 있게 사용자 객체를 반환합니다.
    } catch (e) {
      throw new UnauthorizedException();
    }
  }
}
