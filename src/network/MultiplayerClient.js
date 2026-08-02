import { io } from 'socket.io-client';
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
} from '../../shared/protocol.js';

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_SERVER_URL = import.meta.env?.VITE_SERVER_URL
  ?? 'http://127.0.0.1:3000';

export class MultiplayerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MultiplayerError';
    this.code = code;
  }
}

export class MultiplayerClient {
  constructor({
    serverUrl = DEFAULT_SERVER_URL,
    timeout = DEFAULT_TIMEOUT,
    socketOptions = {},
  } = {}) {
    this.timeout = timeout;
    this.socket = io(serverUrl, {
      autoConnect: false,
      ...socketOptions,
    });
  }

  get connected() {
    return this.socket.connected;
  }

  get playerId() {
    return this.socket.id ?? null;
  }

  connect() {
    if (this.socket.connected) {
      return Promise.resolve(this.socket.id);
    }

    return new Promise((resolve, reject) => {
      const handleConnect = () => {
        cleanup();
        resolve(this.socket.id);
      };
      const handleError = (error) => {
        cleanup();
        reject(new MultiplayerError('CONNECTION_ERROR', error.message));
      };
      const cleanup = () => {
        this.socket.off('connect', handleConnect);
        this.socket.off('connect_error', handleError);
      };

      this.socket.once('connect', handleConnect);
      this.socket.once('connect_error', handleError);
      this.socket.connect();
    });
  }

  disconnect() {
    this.socket.disconnect();
  }

  createRoom(name) {
    return this.emitWithAcknowledgement(CLIENT_EVENTS.CREATE_ROOM, { name });
  }

  joinRoom(code, name) {
    return this.emitWithAcknowledgement(CLIENT_EVENTS.JOIN_ROOM, { code, name });
  }

  leaveRoom() {
    return this.emitWithAcknowledgement(CLIENT_EVENTS.LEAVE_ROOM, {});
  }

  setReady(ready) {
    return this.emitWithAcknowledgement(CLIENT_EVENTS.SET_READY, { ready });
  }

  onConnectionReady(listener) {
    return this.subscribe(SERVER_EVENTS.CONNECTION_READY, listener);
  }

  onRoomState(listener) {
    return this.subscribe(SERVER_EVENTS.ROOM_STATE, listener);
  }

  onMatchReady(listener) {
    return this.subscribe(SERVER_EVENTS.MATCH_READY, listener);
  }

  subscribe(eventName, listener) {
    this.socket.on(eventName, listener);
    return () => this.socket.off(eventName, listener);
  }

  emitWithAcknowledgement(eventName, payload) {
    if (!this.socket.connected) {
      return Promise.reject(new MultiplayerError(
        'NOT_CONNECTED',
        'Client is not connected to the server.',
      ));
    }

    return new Promise((resolve, reject) => {
      this.socket.timeout(this.timeout).emit(
        eventName,
        payload,
        (timeoutError, response) => {
          if (timeoutError) {
            reject(new MultiplayerError(
              'REQUEST_TIMEOUT',
              'Server did not answer in time.',
            ));
            return;
          }

          if (!response?.ok) {
            reject(new MultiplayerError(
              response?.error?.code ?? 'INVALID_RESPONSE',
              response?.error?.message ?? 'Invalid server response.',
            ));
            return;
          }

          resolve(response);
        },
      );
    });
  }
}
