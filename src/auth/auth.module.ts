import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { ConfigService } from '@nestjs/config';
import { KakaoStrategy } from './strategies/kakao.strategy';
import { AuthService } from './auth.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: 'KAKAO_STRATEGY',
      useFactory: (configService: ConfigService) => {
        return new KakaoStrategy(configService);
      },
      inject: [ConfigService],
    },
    AuthService,
  ],
})
export class AuthModule {}
