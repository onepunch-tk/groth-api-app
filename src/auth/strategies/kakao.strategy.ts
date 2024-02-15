import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-kakao';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  private readonly logger = new Logger(KakaoStrategy.name);
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('KAKAO_CLIENT_ID'),
      clientSecret: configService.get<string>('KAKAO_CLIENT_SECRET'),
      callbackURL: configService.get<string>('KAKAO_CALLBACK_URL'),
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done,
  ) {
    const profileJson = profile._json;
    const kakaoId = profileJson.id;
    try {
      const user: {
        accessToken: string;
        kakaoId: string;
        refreshToken: string;
      } = {
        accessToken,
        refreshToken,
        kakaoId,
      };

      done(null, user);
    } catch (e) {
      this.logger.error(e);
      done(e);
    }
  }
}
