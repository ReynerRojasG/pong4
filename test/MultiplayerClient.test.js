import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplicationServer } from '../server/createApplicationServer.js';
import { RoomRegistry } from '../server/RoomRegistry.js';
import {
  MultiplayerClient,
  MultiplayerError,
} from '../src/network/MultiplayerClient.js';

test('provides a reusable client for acknowledged room operations', async () => {
  const roomRegistry = new RoomRegistry({ codeGenerator: () => 'CLIENT' });
  const applicationServer = createApplicationServer({ roomRegistry });
  let client;

  await new Promise((resolve) => {
    applicationServer.httpServer.listen(0, '127.0.0.1', resolve);
  });

  const address = applicationServer.httpServer.address();
  const serverUrl = `http://127.0.0.1:${address.port}`;

  try {
    client = new MultiplayerClient({ serverUrl, timeout: 2000 });

    await assert.rejects(
      () => client.createRoom('PC1'),
      (error) => error instanceof MultiplayerError
        && error.code === 'NOT_CONNECTED',
    );

    const playerId = await client.connect();
    assert.equal(client.connected, true);
    assert.equal(playerId, client.playerId);

    const roomStatePromise = new Promise((resolve) => {
      const unsubscribe = client.onRoomState((room) => {
        unsubscribe();
        resolve(room);
      });
    });
    const createResponse = await client.createRoom('PC1');
    const roomState = await roomStatePromise;

    assert.equal(createResponse.room.code, 'CLIENT');
    assert.equal(roomState.players[0].id, createResponse.playerId);
    assert.equal(client.playerId, createResponse.playerId);
    assert.equal(typeof createResponse.sessionToken, 'string');
    assert.equal('sessionToken' in roomState.players[0], false);

    const leaveResponse = await client.leaveRoom();
    assert.deepEqual(leaveResponse, { ok: true, room: null });
    assert.equal(roomRegistry.size, 0);
  } finally {
    client?.disconnect();
    await applicationServer.close();
  }
});
