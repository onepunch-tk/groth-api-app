import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { CommonResponse } from '../../common/responses/common.response';

@Catch(UnauthorizedException)
export class UnauthorizedExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const statusCode = exception.getStatus
      ? exception.getStatus()
      : HttpStatus.UNAUTHORIZED;
    const unAuthorizedResponse: CommonResponse = {
      statusCode,
      message: 'Unauthorized',
    };
    reply.send(unAuthorizedResponse);
  }
}
