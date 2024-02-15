import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KakaoStrategy } from './strategies/kakao.strategy';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [
    {
      provide: 'KAKAO_STRATEGY',
      useFactory: (configService: ConfigService) => {
        return new KakaoStrategy(configService);
      },
      inject: [ConfigService],
    },
  ],
})
export class AuthModule {}
