import z from 'zod';
import { FastifyTypedInstance } from './types/fastify';
import { randomUUID } from 'node:crypto';

export async function routes(app: FastifyTypedInstance) {
  app.get('/health', async (request, reply) => {
    console.log('HTTP Server OK!');
  });

  interface User {
    id: string;
    name: string;
    email: string;
  }

  const users: User[] = [];

  app.get(
    '/users',
    {
      schema: {
        tags: ['users'],
        description: 'List users',
        response: {
          200: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              email: z.string()
            })
          )
        }
      }
    },
    () => {
      return users;
    }
  );

  app.post(
    '/users',
    {
      schema: {
        description: 'create a new user',
        tags: ['users'],
        body: z.object({
          name: z.string(),
          email: z.email()
        }),
        response: {
          201: z.null().describe('User created')
        }
      }
    },
    async (request, reply) => {
      const { name, email } = request.body;
      users.push({
        id: randomUUID(),
        name,
        email
      });

      return reply.status(201).send(null);
    }
  );
}
