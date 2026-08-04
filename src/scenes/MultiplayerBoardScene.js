import Phaser from 'phaser';
import { ArcadeBoard } from '../game/ArcadeBoard.js';
import { SIDE_COLORS } from '../game/Constants.js';
import { MATCH_PHASES } from '../../shared/matchConfig.js';

const INPUT_INTERVAL_MS = 1000 / 30;
const ENTITY_LERP = 0.34;

export class MultiplayerBoardScene extends Phaser.Scene {
  constructor({
    client,
    room,
    player,
    initialState,
    onExit,
  }) {
    super('MultiplayerBoardScene');
    this.client = client;
    this.room = room;
    this.localPlayer = player;
    this.latestState = initialState;
    this.onExit = onExit;
    this.playerViews = new Map();
    this.scoreTexts = new Map();
    this.unsubscribers = [];
    this.nextInputAt = 0;
    this.lastGoalSequence = null;
    this.hasEnded = false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0e13');
    this.board = new ArcadeBoard(this);
    this.createEntities();
    this.createInterface();
    this.layoutBoard();
    this.applyState(this.latestState, true);

    this.unsubscribers = [
      this.client.onMatchState((state) => this.receiveState(state)),
      this.client.onMatchEnded((payload) => this.receiveMatchEnd(payload)),
      this.client.onMatchError((error) => this.showNetworkMessage(error.message)),
      this.client.onDisconnect(() => this.receiveMatchEnd({
        reason: 'connection-lost',
        state: this.latestState,
      })),
    ];

    this.scale.on('resize', this.layoutBoard, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  update(time) {
    if (!this.latestState || this.hasEnded) {
      return;
    }

    this.interpolateEntities();

    if (time >= this.nextInputAt) {
      this.nextInputAt = time + INPUT_INTERVAL_MS;
      this.sendPaddleInput();
    }
  }

  createEntities() {
    for (const player of this.room.players) {
      const color = SIDE_COLORS[player.side];
      const glow = this.add.circle(0, 0, 38, color, 0.2).setDepth(10);
      const disk = this.add.circle(0, 0, 30, color, 0.92).setDepth(11);
      const core = this.add.circle(0, 0, 13, 0xffffff, 0.2).setDepth(12);

      if (player.id === this.localPlayer.id) {
        disk.setStrokeStyle(4, 0xffffff, 0.94);
        glow.setAlpha(0.36);
      }

      this.playerViews.set(player.id, {
        glow,
        disk,
        core,
        targetX: 0,
        targetY: 0,
      });
    }

    this.ballGlow = this.add.circle(0, 0, 25, 0xffffff, 0.12).setDepth(20);
    this.ball = this.add.circle(0, 0, 14, 0xffffff, 1).setDepth(21);
    this.ballTarget = { x: 0, y: 0 };
  }

  createInterface() {
    const scoreStyle = {
      fontFamily: 'Space Grotesk, Arial, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      stroke: '#080b14',
      strokeThickness: 5,
    };

    for (const player of this.room.players) {
      const color = `#${SIDE_COLORS[player.side].toString(16).padStart(6, '0')}`;
      const text = this.add.text(0, 0, '', { ...scoreStyle, color }).setDepth(900);
      this.scoreTexts.set(player.id, text);
    }

    this.timerText = this.add.text(0, 0, '02:00', {
      fontFamily: 'Space Grotesk, Arial, sans-serif',
      fontSize: '38px',
      fontStyle: 'bold',
      color: '#e1fdff',
      stroke: '#00dbe7',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(900);

    this.phaseText = this.add.text(0, 0, '', {
      fontFamily: 'Space Grotesk, Arial, sans-serif',
      fontSize: '76px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#00dbe7',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5).setDepth(1100);

    this.networkText = this.add.text(0, 0, '', {
      fontFamily: 'Space Grotesk, Arial, sans-serif',
      fontSize: '18px',
      color: '#ff8a80',
      backgroundColor: '#080b14',
      padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setDepth(1300).setVisible(false);
  }

  receiveState(state) {
    if (
      state.roomCode !== this.room.code
      || state.sequence < (this.latestState?.sequence ?? -1)
    ) {
      return;
    }

    this.latestState = state;
    this.applyState(state, false);
  }

  receiveMatchEnd(payload) {
    if (this.hasEnded) {
      return;
    }

    if (payload.state?.roomCode && payload.state.roomCode !== this.room.code) {
      return;
    }

    this.hasEnded = true;
    this.latestState = payload.state ?? this.latestState;
    this.applyState(this.latestState, false);
    this.showEndScreen(payload.reason);
  }

  applyState(state, immediate) {
    if (!state) {
      return;
    }

    for (const player of state.players) {
      const view = this.playerViews.get(player.id);

      if (!view) {
        continue;
      }

      const position = this.serverToWorld(player.x, player.y, state.field);
      view.targetX = position.x;
      view.targetY = position.y;

      if (immediate) {
        this.setPlayerViewPosition(view, position.x, position.y);
      }

      this.scoreTexts.get(player.id)?.setText(`PC${player.slot}  ${player.score}`);
    }

    const ballPosition = this.serverToWorld(state.ball.x, state.ball.y, state.field);
    this.ballTarget = ballPosition;

    if (immediate) {
      this.ball.setPosition(ballPosition.x, ballPosition.y);
      this.ballGlow.setPosition(ballPosition.x, ballPosition.y);
    }

    this.timerText.setText(this.formatTime(state.timeRemaining));
    this.updatePhaseText(state);
    this.positionInterface();
  }

  updatePhaseText(state) {
    if (state.phase === MATCH_PHASES.COUNTDOWN) {
      this.phaseText.setText(String(Math.max(1, state.countdownRemaining)));
      this.phaseText.setVisible(true);
      return;
    }

    if (state.phase === MATCH_PHASES.GOAL) {
      const scoringPlayer = state.players.find(
        (player) => player.id === state.lastGoal?.scoringPlayerId,
      );
      this.phaseText.setText(`GOL\n${scoringPlayer?.name ?? ''}`);
      this.phaseText.setVisible(true);

      if (state.lastGoal?.sequence !== this.lastGoalSequence) {
        this.lastGoalSequence = state.lastGoal?.sequence;
        this.cameras.main.flash(140, 255, 255, 255, false);
      }
      return;
    }

    this.phaseText.setVisible(false);
  }

  interpolateEntities() {
    for (const view of this.playerViews.values()) {
      const x = Phaser.Math.Linear(view.disk.x, view.targetX, ENTITY_LERP);
      const y = Phaser.Math.Linear(view.disk.y, view.targetY, ENTITY_LERP);
      this.setPlayerViewPosition(view, x, y);
    }

    const ballX = Phaser.Math.Linear(this.ball.x, this.ballTarget.x, ENTITY_LERP);
    const ballY = Phaser.Math.Linear(this.ball.y, this.ballTarget.y, ENTITY_LERP);
    this.ball.setPosition(ballX, ballY);
    this.ballGlow.setPosition(ballX, ballY);
  }

  sendPaddleInput() {
    const pointer = this.input.activePointer;
    const playBounds = this.board.getWorldPlayBounds();
    const field = this.latestState.field;
    const x = ((pointer.worldX - playBounds.x) / playBounds.width) * field.width;
    const y = ((pointer.worldY - playBounds.y) / playBounds.height) * field.height;

    this.client.sendPaddleInput({ x, y });
  }

  serverToWorld(x, y, field) {
    const playBounds = this.board.getWorldPlayBounds();

    return {
      x: playBounds.x + (x / field.width) * playBounds.width,
      y: playBounds.y + (y / field.height) * playBounds.height,
    };
  }

  layoutBoard() {
    const { width, height } = this.scale.gameSize;
    const margin = Math.min(width, height) * 0.08;
    const maximumWidth = width - margin * 2;
    const maximumHeight = height - margin * 2;
    let boardWidth = maximumWidth;
    let boardHeight = boardWidth / (4 / 3);

    if (boardHeight > maximumHeight) {
      boardHeight = maximumHeight;
      boardWidth = boardHeight * (4 / 3);
    }

    this.board.container.setPosition(width / 2, height / 2);
    this.board.resize(boardWidth, boardHeight);

    if (this.latestState) {
      this.applyState(this.latestState, true);
    }

    this.positionInterface();
  }

  positionInterface() {
    const { width, height } = this.scale.gameSize;
    const scorePositions = {
      left: { x: 28, y: height / 2, originX: 0, originY: 0.5 },
      top: { x: width / 2, y: 82, originX: 0.5, originY: 0.5 },
      right: { x: width - 28, y: height / 2, originX: 1, originY: 0.5 },
      bottom: { x: width / 2, y: height - 38, originX: 0.5, originY: 0.5 },
    };

    for (const player of this.room.players) {
      const text = this.scoreTexts.get(player.id);
      const position = scorePositions[player.side];
      text?.setPosition(position.x, position.y).setOrigin(position.originX, position.originY);
    }

    this.timerText?.setPosition(width / 2, 35);
    this.phaseText?.setPosition(width / 2, height / 2);
    this.networkText?.setPosition(width / 2, height - 84);
  }

  setPlayerViewPosition(view, x, y) {
    view.glow.setPosition(x, y);
    view.disk.setPosition(x, y);
    view.core.setPosition(x, y);
  }

  showNetworkMessage(message) {
    this.networkText.setText(message).setVisible(true);
    this.time.delayedCall(1800, () => this.networkText?.setVisible(false));
  }

  showEndScreen(reason) {
    const { width, height } = this.scale.gameSize;
    const overlay = this.add.container(0, 0).setDepth(2000);
    const background = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x070910,
      0.96,
    );
    const completed = reason === 'completed';
    const title = this.add.text(
      width / 2,
      height / 2 - 150,
      completed ? 'FIN DE LA PARTIDA' : 'PARTIDA INTERRUMPIDA',
      {
        fontFamily: 'Space Grotesk, Arial, sans-serif',
        fontSize: '42px',
        fontStyle: 'bold',
        color: '#ffffff',
      },
    ).setOrigin(0.5);

    const resultText = this.createResultText(reason);
    const result = this.add.text(width / 2, height / 2 - 65, resultText, {
      fontFamily: 'Space Grotesk, Arial, sans-serif',
      fontSize: '25px',
      color: '#a9c6ca',
      align: 'center',
    }).setOrigin(0.5);

    const buttonBackground = this.add.rectangle(0, 0, 330, 58, 0x151a2b)
      .setStrokeStyle(2, 0x00dbe7);
    const buttonLabel = this.add.text(0, 0, 'VOLVER AL LOBBY', {
      fontFamily: 'Space Grotesk, Arial, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#e1fdff',
    }).setOrigin(0.5);
    const button = this.add.container(width / 2, height / 2 + 80, [
      buttonBackground,
      buttonLabel,
    ]).setSize(330, 58).setInteractive({ useHandCursor: true });

    button.on('pointerover', () => buttonBackground.setFillStyle(0x25345c));
    button.on('pointerout', () => buttonBackground.setFillStyle(0x151a2b));
    button.once('pointerdown', () => this.onExit(reason));
    overlay.add([background, title, result, button]);
  }

  createResultText(reason) {
    if (reason === 'player-disconnected' || reason === 'player-left') {
      return 'Un jugador salio de la partida.';
    }

    if (reason === 'connection-lost') {
      return 'Se perdio la conexion con el servidor.';
    }

    const leaders = this.latestState?.players.filter(
      (player) => this.latestState.leaders.includes(player.id),
    ) ?? [];
    const names = leaders.map((player) => player.name).join(' Y ');
    return leaders.length > 1 ? `EMPATE: ${names}` : `MVP: ${names}`;
  }

  formatTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  cleanup() {
    this.scale.off('resize', this.layoutBoard, this);

    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }

    this.unsubscribers = [];
  }
}
