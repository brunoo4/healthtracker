import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    // erro de validação de domínio (regras do service)
    if (error instanceof ValidationError) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: error.message }
      });
    }

    // recurso não encontrado
    if (error instanceof NotFoundError) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: error.message }
      });
    }

    // erro de validação de formato (Zod, da rota)
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_INPUT',
          message: 'Parâmetros inválidos',
          issues: error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message
          }))
        }
      });
    }

    // fallback: erro não previsto → 500 sem vazar detalhe
    request.log.error(error);
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' }
    });
  });
}
