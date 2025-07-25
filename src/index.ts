// index.ts
import cluster from "cluster";
import os from "os";
import dotenv from 'dotenv';
dotenv.config();

import { config } from "./config.js";
import { createServer } from "./server.js";
// import { initDb } from './db/database';
const numCPUs = os.cpus().length;


if (cluster.isPrimary) {
  console.log(`Primary ${process.pid}`);
  for (let i = 0; i < numCPUs; i++) cluster.fork();
  cluster.on('exit', (worker) => {
    console.warn(`🏴‍☠️ Worker ${worker.process.pid} died; restarting...`);
    cluster.fork();
  });
} else {
  const server = await createServer();
  await server.listen({ host: config.host, port: config.port });
  console.log(`🚀 Worker ${process.pid} ready`);
}


// async function start() {
//   try {
//     // await initDb; // initialize here after dotenv loaded

//     const server = await createServer();
//     await server.listen({
//       host: config.host,
//       port: config.port,
//     });

//     console.log(`🚀 Server ready at http://${config.host}:${config.port}`);
//   } catch (error) {
//     console.error('❌ Error starting server:', error);
//     process.exit(1);
//   }
// }

// start();
