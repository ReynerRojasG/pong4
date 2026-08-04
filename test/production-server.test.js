import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createApplicationServer } from '../server/createApplicationServer.js';

const clientDistPath = fileURLToPath(new URL('./fixtures/client', import.meta.url));

test('serves the production client and SPA routes from Express', async () => {
  const applicationServer = createApplicationServer({ clientDistPath });

  await new Promise((resolve) => {
    applicationServer.httpServer.listen(0, '127.0.0.1', resolve);
  });

  const address = applicationServer.httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;

  try {
    for (const path of ['/', '/room/ABC234']) {
      const response = await fetch(`${url}${path}`);
      const body = await response.text();

      assert.equal(response.status, 200);
      assert.match(body, /Pong production client/);
    }

    const healthResponse = await fetch(`${url}/health`);
    assert.deepEqual(await healthResponse.json(), {
      status: 'ok',
      rooms: 0,
      matches: 0,
    });
  } finally {
    await applicationServer.close();
  }
});
