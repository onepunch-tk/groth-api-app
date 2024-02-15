import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-kakao';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ISocialUser, Social } from '../interfaces/social-user.interface';

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
    try {
      const user: ISocialUser = {
        nickname: profile.displayName,
        username: profile._json.kakao_account.email,
        password: profile.id,
        social: Social.KAKAO,
      };

      done(null, user);
    } catch (e) {
      this.logger.error(e);
      done(e);
    }
  }
}
