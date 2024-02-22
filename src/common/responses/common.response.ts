import { HttpStatus } from '@nestjs/common';

export interface CommonResponse {
  statusCode: HttpStatus;
  message?: string;
}
