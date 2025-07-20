import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema.js';

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, {
    schema,
    logger: {
      logQuery: (query, params) => {
        console.log('[Drizzle SQL]', query);
        if (params?.length) {
          console.log('[Drizzle Params]', params);
        }
      },
    },
  });
  fastify.decorate('db', db);
};

export default fp(dbPlugin); // ⬅️ Wrapping with fastify-plugin

// Extend FastifyInstance to include `db`
declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof drizzle>;
  }
}
