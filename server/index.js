import { createApplicationServer } from './createApplicationServer.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '0.0.0.0';
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim())
  : undefined;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const applicationServer = createApplicationServer({ allowedOrigins });
let isClosing = false;

applicationServer.httpServer.listen(port, host, () => {
  console.log(`Pong server listening on http://${host}:${port}`);
});

async function shutdown(signal) {
  if (isClosing) {
    return;
  }

  isClosing = true;
  console.log(`Closing Pong server after ${signal}.`);

  try {
    await applicationServer.close();
    process.exitCode = 0;
  } catch (error) {
    console.error('Could not close Pong server:', error);
    process.exitCode = 1;
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
