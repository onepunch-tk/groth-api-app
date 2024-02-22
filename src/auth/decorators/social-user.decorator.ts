import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ISocialUser } from '../interfaces/social-user.interface';

export const SocialUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as ISocialUser;
  },
);
