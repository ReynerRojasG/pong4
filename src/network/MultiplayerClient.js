import { io } from 'socket.io-client';
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
} from '../../shared/protocol.js';

const DEFAULT_TIMEOUT = 5000;
const SESSION_STORAGE_KEY = 'pong4.multiplayer-session';
const DEFAULT_SERVER_URL = import.meta.env?.VITE_SERVER_URL
  ?? (import.meta.env?.DEV
    ? 'http://127.0.0.1:3000'
    : typeof window === 'undefined'
      ? 'http://127.0.0.1:3000'
      : window.location.origin);

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
    this.session = this.loadSession();
    this.currentPlayerId = this.session?.playerId ?? null;
    const sessionAuth = this.session?.sessionToken
      ? { sessionToken: this.session.sessionToken }
      : {};
    this.socket = io(serverUrl, {
      autoConnect: false,
      ...socketOptions,
      auth: {
        ...socketOptions.auth,
        ...sessionAuth,
      },
    });
    this.socket.on(SERVER_EVENTS.CONNECTION_READY, (payload) => {
      if (payload?.resumed) {
        this.currentPlayerId = payload.playerId;
        return;
      }

      if (this.session) {
        this.clearSession();
      }

      this.currentPlayerId = payload?.playerId ?? this.socket.id ?? null;
    });
  }

  get connected() {
    return this.socket.connected;
  }

  get playerId() {
    return this.currentPlayerId ?? this.socket.id ?? null;
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

  async createRoom(name) {
    const response = await this.emitWithAcknowledgement(
      CLIENT_EVENTS.CREATE_ROOM,
      { name },
    );
    this.rememberSession(response);
    return response;
  }

  async joinRoom(code, name) {
    const response = await this.emitWithAcknowledgement(
      CLIENT_EVENTS.JOIN_ROOM,
      { code, name },
    );
    this.rememberSession(response);
    return response;
  }

  async leaveRoom() {
    const response = await this.emitWithAcknowledgement(CLIENT_EVENTS.LEAVE_ROOM, {});
    this.clearSession();
    return response;
  }

  setReady(ready) {
    return this.emitWithAcknowledgement(CLIENT_EVENTS.SET_READY, { ready });
  }

  sendPaddleInput(position) {
    if (!this.socket.connected) {
      return false;
    }

    this.socket.emit(CLIENT_EVENTS.PADDLE_INPUT, position);
    return true;
  }

  onConnectionReady(listener) {
    return this.subscribe(SERVER_EVENTS.CONNECTION_READY, listener);
  }

  onConnect(listener) {
    return this.subscribe('connect', listener);
  }

  onDisconnect(listener) {
    return this.subscribe('disconnect', listener);
  }

  onConnectError(listener) {
    return this.subscribe('connect_error', listener);
  }

  onRoomState(listener) {
    return this.subscribe(SERVER_EVENTS.ROOM_STATE, listener);
  }

  onMatchReady(listener) {
    return this.subscribe(SERVER_EVENTS.MATCH_READY, listener);
  }

  onMatchState(listener) {
    return this.subscribe(SERVER_EVENTS.MATCH_STATE, listener);
  }

  onMatchEnded(listener) {
    return this.subscribe(SERVER_EVENTS.MATCH_ENDED, listener);
  }

  onMatchError(listener) {
    return this.subscribe(SERVER_EVENTS.MATCH_ERROR, listener);
  }

  subscribe(eventName, listener) {
    this.socket.on(eventName, listener);
    return () => this.socket.off(eventName, listener);
  }

  rememberSession(response) {
    if (!response?.playerId || !response?.sessionToken) {
      return;
    }

    this.session = {
      playerId: response.playerId,
      sessionToken: response.sessionToken,
    };
    this.currentPlayerId = response.playerId;
    this.socket.auth = { sessionToken: response.sessionToken };

    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.session));
      } catch {
        // The in-memory session still supports transport reconnection.
      }
    }
  }

  clearSession() {
    this.session = null;
    this.currentPlayerId = null;
    this.socket.auth = {};

    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        // The in-memory session is already cleared.
      }
    }
  }

  loadSession() {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY));

      if (
        typeof value?.playerId === 'string'
        && typeof value?.sessionToken === 'string'
      ) {
        return value;
      }
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }

    return null;
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
