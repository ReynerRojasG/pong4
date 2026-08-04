import test from 'node:test';
import assert from 'node:assert/strict';
import { io as createSocketClient } from 'socket.io-client';
import { createApplicationServer } from '../server/createApplicationServer.js';
import { RoomRegistry } from '../server/RoomRegistry.js';
import {
  CLIENT_EVENTS,
  ROOM_PHASES,
  SERVER_EVENTS,
} from '../shared/protocol.js';

function connectClient(url, socketOptions = {}) {
  return new Promise((resolve, reject) => {
    const socket = createSocketClient(url, {
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
      ...socketOptions,
    });

    const handleError = (error) => {
      socket.disconnect();
      reject(error);
    };

    socket.once('connect_error', handleError);
    socket.once('connect', () => {
      socket.off('connect_error', handleError);
      resolve(socket);
    });
  });
}

function emitWithAcknowledgement(socket, eventName, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(2000).emit(eventName, payload, (error, response) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(response);
    });
  });
}

function waitForEvent(socket, eventName, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, handleEvent);
      reject(new Error(`Timed out waiting for ${eventName}.`));
    }, 2000);
    const handleEvent = (payload) => {
      if (!predicate(payload)) {
        return;
      }

      clearTimeout(timeout);
      socket.off(eventName, handleEvent);
      resolve(payload);
    };

    socket.on(eventName, handleEvent);
  });
}

async function waitForCondition(predicate) {
  const deadline = Date.now() + 2000;

  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for condition.');
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test('supports a complete four-player room lifecycle over Socket.IO', async () => {
  const roomRegistry = new RoomRegistry({ codeGenerator: () => 'ROOM24' });
  const applicationServer = createApplicationServer({
    roomRegistry,
    disconnectGraceMs: 250,
    goalLogsEnabled: false,
  });
  const clients = [];
  const playerSessions = [];

  await new Promise((resolve) => {
    applicationServer.httpServer.listen(0, '127.0.0.1', resolve);
  });

  const address = applicationServer.httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;

  try {
    const initialHealthResponse = await fetch(`${url}/health`);
    assert.equal(initialHealthResponse.status, 200);
    assert.deepEqual(await initialHealthResponse.json(), {
      status: 'ok',
      rooms: 0,
      matches: 0,
    });

    for (let index = 0; index < 5; index += 1) {
      clients.push(await connectClient(url));
    }

    const createResponse = await emitWithAcknowledgement(
      clients[0],
      CLIENT_EVENTS.CREATE_ROOM,
      { name: 'PC1' },
    );
    assert.equal(createResponse.ok, true);
    assert.equal(createResponse.room.code, 'ROOM24');
    playerSessions[0] = createResponse;

    const activeHealthResponse = await fetch(`${url}/health`);
    assert.deepEqual(await activeHealthResponse.json(), {
      status: 'ok',
      rooms: 1,
      matches: 0,
    });

    for (let index = 1; index < 4; index += 1) {
      const joinResponse = await emitWithAcknowledgement(
        clients[index],
        CLIENT_EVENTS.JOIN_ROOM,
        { code: 'room24', name: `PC${index + 1}` },
      );
      assert.equal(joinResponse.ok, true);
      assert.equal(joinResponse.room.players.length, index + 1);
      playerSessions[index] = joinResponse;
    }

    const fullResponse = await emitWithAcknowledgement(
      clients[4],
      CLIENT_EVENTS.JOIN_ROOM,
      { code: 'ROOM24', name: 'PC5' },
    );
    assert.equal(fullResponse.ok, false);
    assert.equal(fullResponse.error.code, 'ROOM_FULL');

    const matchReadyEvent = waitForEvent(clients[0], SERVER_EVENTS.MATCH_READY);

    for (let index = 0; index < 4; index += 1) {
      const readyResponse = await emitWithAcknowledgement(
        clients[index],
        CLIENT_EVENTS.SET_READY,
        { ready: true },
      );
      assert.equal(readyResponse.ok, true);
    }

    const matchPayload = await matchReadyEvent;
    assert.equal(matchPayload.room.phase, ROOM_PHASES.READY);
    assert.equal(matchPayload.room.players.length, 4);
    assert.equal(matchPayload.state.phase, 'countdown');
    assert.equal(applicationServer.matchManager.size, 1);

    const synchronizedStatePromises = clients.slice(0, 4).map((client) => (
      waitForEvent(
        client,
        SERVER_EVENTS.MATCH_STATE,
        (state) => state.sequence > matchPayload.state.sequence,
      )
    ));
    const synchronizedStates = await Promise.all(synchronizedStatePromises);
    const referenceState = synchronizedStates[0];

    for (const state of synchronizedStates.slice(1)) {
      assert.equal(state.sequence, referenceState.sequence);
      assert.deepEqual(state.ball, referenceState.ball);
      assert.deepEqual(state.players, referenceState.players);
      assert.equal(state.timeRemaining, referenceState.timeRemaining);
    }

    const controlledPlayerId = playerSessions[1].playerId;
    const movedPaddleState = waitForEvent(
      clients[0],
      SERVER_EVENTS.MATCH_STATE,
      (state) => state.players.some(
        (player) => player.id === controlledPlayerId && player.y < 75,
      ),
    );
    clients[1].emit(CLIENT_EVENTS.PADDLE_INPUT, { x: 500, y: 30 });

    const inputPayload = await movedPaddleState;
    const controlledPlayer = inputPayload.players.find(
      (player) => player.id === controlledPlayerId,
    );
    assert.equal(controlledPlayer.side, 'top');
    assert.ok(controlledPlayer.y >= 30);

    const reconnectingPlayerId = playerSessions[3].playerId;
    const activeMatch = applicationServer.matchManager.matches.get('ROOM24').match;
    activeMatch.players.find((player) => player.id === reconnectingPlayerId).score = 4;
    const disconnectedRoomState = waitForEvent(
      clients[0],
      SERVER_EVENTS.ROOM_STATE,
      (room) => room.players.some(
        (player) => player.id === reconnectingPlayerId && !player.connected,
      ),
    );
    clients[3].disconnect();
    await disconnectedRoomState;

    const resumedClient = createSocketClient(url, {
      autoConnect: false,
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
      auth: { sessionToken: playerSessions[3].sessionToken },
    });
    clients.push(resumedClient);
    const connectionReady = waitForEvent(
      resumedClient,
      SERVER_EVENTS.CONNECTION_READY,
      (payload) => payload.resumed,
    );
    const resumedMatchReady = waitForEvent(
      resumedClient,
      SERVER_EVENTS.MATCH_READY,
    );
    resumedClient.connect();

    const [resumedConnection, resumedMatch] = await Promise.all([
      connectionReady,
      resumedMatchReady,
    ]);
    const resumedPlayer = resumedConnection.room.players.find(
      (player) => player.id === reconnectingPlayerId,
    );

    assert.equal(resumedConnection.playerId, reconnectingPlayerId);
    assert.equal(resumedPlayer.name, 'PC4');
    assert.equal(resumedPlayer.side, 'bottom');
    assert.equal(resumedPlayer.connected, true);
    assert.equal(
      resumedMatch.state.players.find((player) => player.id === reconnectingPlayerId).score,
      4,
    );

    const roomAfterDisconnect = waitForEvent(
      clients[0],
      SERVER_EVENTS.ROOM_STATE,
      (room) => room.players.length === 3,
    );
    const matchAfterDisconnect = waitForEvent(
      clients[0],
      SERVER_EVENTS.MATCH_ENDED,
    );
    resumedClient.disconnect();

    const disconnectPayload = await roomAfterDisconnect;
    const matchEndedPayload = await matchAfterDisconnect;
    assert.equal(disconnectPayload.phase, ROOM_PHASES.LOBBY);
    assert.equal(matchEndedPayload.reason, 'reconnect-timeout');
    assert.equal(applicationServer.matchManager.size, 0);

    for (const client of clients) {
      client.disconnect();
    }

    await waitForCondition(() => roomRegistry.size === 0);
    assert.equal(roomRegistry.size, 0);
  } finally {
    for (const client of clients) {
      client.disconnect();
    }

    await applicationServer.close();
  }
});
