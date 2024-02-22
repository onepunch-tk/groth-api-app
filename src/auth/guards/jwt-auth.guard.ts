import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      // 여기서 발생한 에러는 주로 액세스 토큰이 유효하지 않음을 의미합니다.
      // 클라이언트에 적절한 예외를 던져 리프레시 토큰을 사용한 토큰 갱신을 유도합니다.
      throw new UnauthorizedException(
        'Access token is invalid or expired. Please refresh token.',
      );
    }
  }
}
