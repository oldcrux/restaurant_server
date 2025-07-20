// index.ts
import dotenv from 'dotenv';
dotenv.config();

import { config } from "./config.js";
import { createServer } from "./server.js";
// import { initDb } from './db/database';

async function start() {
  try {
    // await initDb; // initialize here after dotenv loaded

    const server = await createServer();
    await server.listen({
      host: config.host,
      port: config.port,
    });

    console.log(`🚀 Server ready at http://${config.host}:${config.port}`);
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

start();
