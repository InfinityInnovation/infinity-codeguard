import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { ApiErrorBody } from '@codeguard/contracts';

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const correlationId =
      typeof request.headers['x-correlation-id'] === 'string'
        ? request.headers['x-correlation-id']
        : randomUUID();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body: ApiErrorBody = {
      error: {
        code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED',
        message:
          status === 500
            ? 'An unexpected error occurred'
            : exception instanceof Error
              ? exception.message
              : 'Request failed',
        correlationId,
      },
    };
    response.setHeader('x-correlation-id', correlationId).status(status).json(body);
  }
}
