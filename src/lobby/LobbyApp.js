import { MultiplayerError } from '../network/MultiplayerClient.js';
import {
  buildLobbySlots,
  getLocalPlayer,
  sanitizeRoomCode,
} from './lobbyModel.js';

const ERROR_MESSAGES = Object.freeze({
  ROOM_NOT_FOUND: 'No encontramos una sala con ese codigo.',
  ROOM_FULL: 'La sala ya tiene cuatro jugadores.',
  ALREADY_IN_ROOM: 'Ya formas parte de una sala.',
  INVALID_NAME: 'Escribe un nombre de 1 a 24 caracteres.',
  INVALID_ROOM_CODE: 'El codigo debe contener seis letras o numeros.',
  NOT_CONNECTED: 'No hay conexion con el servidor.',
  REQUEST_TIMEOUT: 'El servidor tardo demasiado en responder.',
  CONNECTION_ERROR: 'No fue posible conectar con el servidor.',
});

function createElement(tagName, { className, text, attributes } = {}) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  for (const [name, value] of Object.entries(attributes ?? {})) {
    element.setAttribute(name, value);
  }

  return element;
}

function createButton(text, className = 'button button-primary') {
  return createElement('button', {
    className,
    text,
    attributes: { type: 'button' },
  });
}

export class LobbyApp {
  constructor({ root, client, onMatchReady, onStartLocal }) {
    this.root = root;
    this.client = client;
    this.onMatchReady = onMatchReady;
    this.onStartLocal = onStartLocal;

    this.connectionStatus = 'connecting';
    this.room = null;
    this.errorMessage = '';
    this.noticeMessage = '';
    this.draftName = '';
    this.draftCode = '';
    this.isBusy = false;
    this.hasStarted = false;
    this.isDestroyed = false;
    this.launchTimer = null;
    this.unsubscribers = [];
  }

  async start() {
    this.unsubscribers = [
      this.client.onConnect(() => this.handleConnect()),
      this.client.onDisconnect(() => this.handleDisconnect()),
      this.client.onRoomState((room) => this.handleRoomState(room)),
      this.client.onMatchReady((payload) => this.handleMatchReady(payload)),
    ];

    this.render();
    await this.retryConnection();
  }

  destroy({ disconnect = false } = {}) {
    this.isDestroyed = true;
    clearTimeout(this.launchTimer);

    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }

    this.unsubscribers = [];

    if (disconnect) {
      this.client.disconnect();
    }
  }

  async retryConnection() {
    if (this.isBusy) {
      return;
    }

    if (this.client.connected) {
      this.connectionStatus = 'connected';
      this.render();
      return;
    }

    this.isBusy = true;
    this.connectionStatus = 'connecting';
    this.errorMessage = '';
    this.render();

    try {
      await this.client.connect();
      this.connectionStatus = 'connected';
    } catch (error) {
      this.connectionStatus = 'disconnected';
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isBusy = false;
      this.render();
    }
  }

  handleConnect() {
    if (this.isDestroyed) {
      return;
    }

    this.connectionStatus = 'connected';
    this.errorMessage = '';
    this.render();
  }

  handleDisconnect() {
    if (this.isDestroyed) {
      return;
    }

    const wasInRoom = Boolean(this.room);
    this.connectionStatus = 'disconnected';
    this.room = null;
    this.isBusy = false;
    this.errorMessage = wasInRoom
      ? 'La conexion se perdio. Vuelve a entrar a la sala.'
      : 'Se perdio la conexion con el servidor.';
    this.render();
  }

  handleRoomState(room) {
    if (this.isDestroyed || this.hasStarted) {
      return;
    }

    this.room = room;
    this.errorMessage = '';
    this.render();
  }

  handleMatchReady({ room, state }) {
    if (this.isDestroyed || this.hasStarted) {
      return;
    }

    const player = getLocalPlayer(room, this.client.playerId);

    if (!player) {
      this.errorMessage = 'No fue posible identificar tu espacio en la sala.';
      this.render();
      return;
    }

    this.room = room;
    this.hasStarted = true;
    this.render();
    this.launchTimer = setTimeout(() => {
      if (!this.isDestroyed) {
        this.onMatchReady({ room, player, state });
      }
    }, 700);
  }

  async createRoom() {
    const name = this.validateName();

    if (!name) {
      return;
    }

    await this.runAction(async () => {
      const response = await this.client.createRoom(name);
      this.room = response.room;
    });
  }

  async joinRoom() {
    const name = this.validateName();

    if (!name) {
      return;
    }

    if (this.draftCode.length !== 6) {
      this.errorMessage = ERROR_MESSAGES.INVALID_ROOM_CODE;
      this.render();
      return;
    }

    await this.runAction(async () => {
      const response = await this.client.joinRoom(this.draftCode, name);
      this.room = response.room;
    });
  }

  async toggleReady() {
    const player = getLocalPlayer(this.room, this.client.playerId);

    if (!player) {
      return;
    }

    await this.runAction(async () => {
      const response = await this.client.setReady(!player.ready);
      this.room = response.room;
    });
  }

  async leaveRoom() {
    await this.runAction(async () => {
      await this.client.leaveRoom();
      this.room = null;
      this.noticeMessage = 'Saliste de la sala.';
    });
  }

  async copyRoomCode() {
    try {
      await navigator.clipboard.writeText(this.room.code);
      this.noticeMessage = 'Codigo copiado.';
      this.errorMessage = '';
    } catch {
      this.errorMessage = 'No se pudo copiar. Selecciona el codigo manualmente.';
    }

    this.render();
  }

  startLocalGame() {
    this.onStartLocal();
  }

  validateName() {
    const name = this.draftName.trim();

    if (name.length === 0 || name.length > 24) {
      this.errorMessage = ERROR_MESSAGES.INVALID_NAME;
      this.render();
      return null;
    }

    return name;
  }

  async runAction(action) {
    if (this.isBusy || this.connectionStatus !== 'connected') {
      return;
    }

    this.isBusy = true;
    this.errorMessage = '';
    this.noticeMessage = '';
    this.render();

    try {
      await action();
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isBusy = false;
      this.render();
    }
  }

  getErrorMessage(error) {
    if (error instanceof MultiplayerError) {
      return ERROR_MESSAGES[error.code] ?? error.message;
    }

    return 'Ocurrio un error inesperado.';
  }

  render() {
    if (this.isDestroyed) {
      return;
    }

    const shell = createElement('div', { className: 'lobby-shell' });
    shell.append(this.renderHeader());

    if (this.hasStarted) {
      shell.append(this.renderLaunchState());
    } else if (this.room) {
      shell.append(this.renderRoom());
    } else {
      shell.append(this.renderWelcome());
    }

    shell.append(this.renderFooter());
    this.root.replaceChildren(shell);
  }

  renderHeader() {
    const header = createElement('header', { className: 'lobby-header' });
    const brand = createElement('div', { className: 'lobby-brand' });
    const brandMark = createElement('span', { className: 'brand-mark', text: 'P4' });
    const brandText = createElement('div');
    brandText.append(
      createElement('strong', { text: 'PONG 4' }),
      createElement('span', { text: 'ARENA MULTIJUGADOR' }),
    );
    brand.append(brandMark, brandText);

    const statusLabels = {
      connected: 'EN LINEA',
      connecting: 'CONECTANDO',
      disconnected: 'SIN SERVIDOR',
    };
    const status = createElement('div', {
      className: `connection-pill connection-${this.connectionStatus}`,
    });
    status.append(
      createElement('span', { className: 'connection-dot' }),
      createElement('span', { text: statusLabels[this.connectionStatus] }),
    );
    header.append(brand, status);
    return header;
  }

  renderWelcome() {
    const main = createElement('main', { className: 'welcome-layout' });
    const intro = createElement('section', { className: 'lobby-intro' });
    intro.append(
      createElement('p', { className: 'eyebrow', text: 'CUATRO LADOS. UNA ARENA.' }),
      createElement('h1', { text: 'Entra al siguiente saque.' }),
      createElement('p', {
        className: 'intro-copy',
        text: 'Crea una sala privada o usa un codigo para ocupar uno de los cuatro lados del tablero.',
      }),
      this.renderArenaPreview(),
    );

    const panel = createElement('section', { className: 'entry-panel' });
    panel.append(
      createElement('p', { className: 'panel-kicker', text: 'ACCESO A LA ARENA' }),
      createElement('h2', { text: 'Prepara tu jugador' }),
    );

    const nameLabel = createElement('label', {
      className: 'field-label',
      text: 'NOMBRE DEL JUGADOR',
      attributes: { for: 'player-name' },
    });
    const nameInput = createElement('input', {
      className: 'text-input',
      attributes: {
        id: 'player-name',
        type: 'text',
        maxlength: '24',
        placeholder: 'Ejemplo: Isaac',
        autocomplete: 'nickname',
      },
    });
    nameInput.value = this.draftName;
    nameInput.addEventListener('input', (event) => {
      this.draftName = event.target.value;
    });

    const createRoomButton = createButton(
      this.isBusy ? 'CREANDO...' : 'CREAR SALA',
    );
    createRoomButton.disabled = this.connectionStatus !== 'connected' || this.isBusy;
    createRoomButton.addEventListener('click', () => this.createRoom());

    const divider = createElement('div', { className: 'entry-divider' });
    divider.append(
      createElement('span'),
      createElement('small', { text: 'O UNETE CON CODIGO' }),
      createElement('span'),
    );

    const joinRow = createElement('div', { className: 'join-row' });
    const codeInput = createElement('input', {
      className: 'text-input code-input',
      attributes: {
        type: 'text',
        maxlength: '6',
        placeholder: 'ABC234',
        'aria-label': 'Codigo de sala',
        autocomplete: 'off',
      },
    });
    codeInput.value = this.draftCode;
    codeInput.addEventListener('input', (event) => {
      this.draftCode = sanitizeRoomCode(event.target.value);
      event.target.value = this.draftCode;
    });
    codeInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.joinRoom();
      }
    });

    const joinButton = createButton('UNIRME', 'button button-secondary');
    joinButton.disabled = this.connectionStatus !== 'connected' || this.isBusy;
    joinButton.addEventListener('click', () => this.joinRoom());
    joinRow.append(codeInput, joinButton);

    panel.append(nameLabel, nameInput, createRoomButton, divider, joinRow);

    if (this.connectionStatus === 'disconnected') {
      const retryButton = createButton('REINTENTAR CONEXION', 'button button-ghost');
      retryButton.disabled = this.isBusy;
      retryButton.addEventListener('click', () => this.retryConnection());
      panel.append(retryButton);
    }

    panel.append(this.renderMessage());

    const localButton = createButton('JUGAR EN MODO LOCAL', 'local-link');
    localButton.addEventListener('click', () => this.startLocalGame());
    panel.append(localButton);

    main.append(intro, panel);
    return main;
  }

  renderArenaPreview() {
    const preview = createElement('div', { className: 'arena-preview' });
    const board = createElement('div', { className: 'mini-board' });
    const sides = [
      ['top', '02'],
      ['right', '03'],
      ['bottom', '04'],
      ['left', '01'],
    ];

    for (const [side, label] of sides) {
      board.append(createElement('span', {
        className: `mini-player mini-${side}`,
        text: label,
      }));
    }

    board.append(createElement('span', { className: 'mini-ball' }));
    preview.append(board);
    return preview;
  }

  renderRoom() {
    const main = createElement('main', { className: 'room-layout' });
    const roomHeader = createElement('section', { className: 'room-heading' });
    const titleGroup = createElement('div');
    titleGroup.append(
      createElement('p', { className: 'eyebrow', text: 'SALA PRIVADA' }),
      createElement('h1', { text: `Codigo ${this.room.code}` }),
      createElement('p', {
        text: 'Comparte el codigo y espera a que los cuatro jugadores esten listos.',
      }),
    );
    const roomActions = createElement('div', { className: 'room-heading-actions' });
    const copyButton = createButton('COPIAR CODIGO', 'button button-secondary button-small');
    copyButton.addEventListener('click', () => this.copyRoomCode());
    const leaveButton = createButton('SALIR', 'button button-ghost button-small');
    leaveButton.disabled = this.isBusy;
    leaveButton.addEventListener('click', () => this.leaveRoom());
    roomActions.append(copyButton, leaveButton);
    roomHeader.append(titleGroup, roomActions);

    const slotsGrid = createElement('section', {
      className: 'player-slots',
      attributes: { 'aria-label': 'Jugadores de la sala' },
    });

    for (const slot of buildLobbySlots(this.room, this.client.playerId)) {
      slotsGrid.append(this.renderPlayerSlot(slot));
    }

    const roomControls = createElement('section', { className: 'room-controls' });
    const localPlayer = getLocalPlayer(this.room, this.client.playerId);
    const occupancy = createElement('div', { className: 'occupancy' });
    const occupancyText = createElement('div');
    occupancyText.append(
      createElement('strong', {
        text: `${this.room.players.length} / ${this.room.maxPlayers}`,
      }),
      createElement('span', { text: 'JUGADORES CONECTADOS' }),
    );
    const progress = createElement('div', { className: 'occupancy-progress' });

    for (let index = 0; index < this.room.maxPlayers; index += 1) {
      progress.append(createElement('span', {
        className: index < this.room.players.length ? 'progress-active' : '',
      }));
    }

    occupancy.append(occupancyText, progress);

    const readyBlock = createElement('div', { className: 'ready-block' });
    readyBlock.append(createElement('p', {
      text: localPlayer?.ready
        ? 'Estas listo. Esperando a los demas jugadores.'
        : 'Confirma cuando estes listo para entrar al tablero.',
    }));
    const readyButton = createButton(
      localPlayer?.ready ? 'CANCELAR LISTO' : 'ESTOY LISTO',
      localPlayer?.ready
        ? 'button button-ready-active'
        : 'button button-primary',
    );
    readyButton.disabled = this.isBusy || this.connectionStatus !== 'connected';
    readyButton.addEventListener('click', () => this.toggleReady());
    readyBlock.append(readyButton);
    roomControls.append(occupancy, readyBlock);

    main.append(roomHeader, slotsGrid, roomControls, this.renderMessage());
    return main;
  }

  renderPlayerSlot(slot) {
    const card = createElement('article', {
      className: `player-slot slot-${slot.side}${slot.isLocal ? ' slot-local' : ''}`,
    });
    const slotTop = createElement('div', { className: 'slot-heading' });
    slotTop.append(
      createElement('span', { className: 'slot-number', text: slot.playerLabel }),
      createElement('span', { className: 'slot-side', text: slot.sideLabel }),
    );

    const avatar = createElement('div', {
      className: `player-avatar${slot.occupied ? '' : ' avatar-empty'}`,
      text: slot.occupied ? slot.player.name.slice(0, 1).toUpperCase() : '+',
    });
    const identity = createElement('div', { className: 'player-identity' });
    identity.append(
      createElement('strong', {
        text: slot.occupied ? slot.player.name : 'Espacio disponible',
      }),
      createElement('span', {
        text: slot.isLocal ? 'TU ESPACIO' : slot.occupied ? 'JUGADOR CONECTADO' : 'ESPERANDO JUGADOR',
      }),
    );

    const status = createElement('span', {
      className: `ready-chip ${slot.player?.ready ? 'ready-yes' : 'ready-no'}`,
      text: slot.player?.ready ? 'LISTO' : slot.occupied ? 'ESPERANDO' : 'LIBRE',
    });
    card.append(slotTop, avatar, identity, status);
    return card;
  }

  renderLaunchState() {
    const main = createElement('main', { className: 'launch-state' });
    const rings = createElement('div', { className: 'launch-rings' });
    rings.append(
      createElement('span'),
      createElement('span'),
      createElement('strong', { text: '4/4' }),
    );
    main.append(
      rings,
      createElement('p', { className: 'eyebrow', text: `SALA ${this.room.code}` }),
      createElement('h1', { text: 'Todos estan listos.' }),
      createElement('p', { text: 'Abriendo la partida sincronizada...' }),
    );
    return main;
  }

  renderMessage() {
    const text = this.errorMessage || this.noticeMessage;
    const className = this.errorMessage ? 'form-message message-error' : 'form-message message-notice';
    return createElement('p', {
      className: `${className}${text ? '' : ' message-empty'}`,
      text: text || ' ',
      attributes: { role: this.errorMessage ? 'alert' : 'status' },
    });
  }

  renderFooter() {
    const footer = createElement('footer', { className: 'lobby-footer' });
    footer.append(
      createElement('span', { text: 'PONG 4 / FASE MULTIJUGADOR' }),
      createElement('span', { text: 'SALAS EN TIEMPO REAL' }),
    );
    return footer;
  }
}
