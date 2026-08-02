import Phaser from 'phaser';
import { BOARD, COLORS, PLAYERS } from '../game/Constants.js';
import { BoardLayout } from '../game/BoardLayout.js';
import { Board } from '../game/Board.js';
import { CameraManager } from '../game/CameraManager.js';
import { Countdown } from '../game/Countdown.js';
import { Physics } from '../game/Physics.js';
import { Player } from '../game/Player.js';
import { Puck } from '../game/Puck.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');

    this.localPlayerIndex = 1;

    this.roundActive = false;
    this.gameActive = false;

    this.gameDuration = 0;
    this.timeRemaining = 0;

    this.gameTimer = null;

    this.timerText = null;
    this.durationUI = null;
    this.gameOverUI = null;
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.background);

    this.layout = new BoardLayout(this.getBoardSize());

    this.board = new Board(this, this.layout);

    this.cameraManager = new CameraManager(this, this.layout, {
      localPlayerIndex: this.localPlayerIndex,
    });

    this.physicsSystem = new Physics(this, this.layout);

    this.puck = new Puck(this, this.layout);

    this.players = this.createPlayers();

    this.countdown = new Countdown(
      this,
      this.cameraManager,
      () => this.startSimulation()
    );

    this.physicsSystem.rebuildWalls();
    this.physicsSystem.bindPuck(this.puck);
    this.physicsSystem.bindPlayers(this.players);

    this.layoutScene();

    this.scale.on('resize', this.layoutScene, this);

    // ==========================================
    // IMPORTANTE:
    // MOSTRAR SELECCIÓN ANTES DE LA PARTIDA
    // ==========================================

    this.showDurationSelection();
  }

  update() {
    if (!this.roundActive || !this.gameActive) {
      return;
    }

    this.players.forEach((player) => player.update());

    this.puck.ensureMoving();

    this.checkGoals();
  }

  createPlayers() {
    return PLAYERS.map((playerConfig) => {
      return new Player(this, this.layout, {
        ...playerConfig,

        getTargetPoint: () => this.getLocalPointerWorldPoint(),

        canMove: () => this.roundActive,
      });
    });
  }

  getLocalPointerWorldPoint() {
    const pointer = this.input.activePointer;

    return this.cameraManager.screenToWorld(
      pointer.x,
      pointer.y
    );
  }

  layoutScene() {
    this.layout.update(this.getBoardSize());

    this.board.draw();

    this.cameraManager.resize(
      this.scale.gameSize.width,
      this.scale.gameSize.height
    );

    this.physicsSystem?.rebuildWalls();

    if (!this.gameActive) {
      this.puck?.resetToCenter();
    }

    this.players?.forEach((player) => {
      player.resetToZoneCenter();
    });

    this.countdown?.placeLabel();

    this.positionTimer();

    this.positionDurationUI();
  }

  getBoardSize() {
    return {
      centerX: 0,
      centerY: 0,
      width: 1000,
      height: 1000 / BOARD.aspectRatio,
    };
  }

  // =========================================================
  // SELECCIÓN DE TIEMPO
  // =========================================================

  showDurationSelection() {
    this.roundActive = false;
    this.gameActive = false;

    this.physicsSystem?.setSimulationEnabled(false);

    this.puck?.resetToCenter();
    this.puck?.stop();

    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;

    this.durationUI = this.add.container(0, 0);

    // Todo el UI queda fijo a la pantalla.
    this.durationUI.setScrollFactor(0);
    this.durationUI.setDepth(1000);

    // Fondo
    const background = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x080b14,
      0.96
    );

    background.setScrollFactor(0);

    this.durationUI.add(background);

    // Título
    const title = this.add.text(
      width / 2,
      height / 2 - 170,
      'PONG 4',
      {
        fontFamily: 'Space Grotesk, Arial, sans-serif',
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#e1fdff',
        stroke: '#00dbe7',
        strokeThickness: 2,
      }
    );

    title.setOrigin(0.5);

    this.durationUI.add(title);

    // Subtítulo
    const subtitle = this.add.text(
      width / 2,
      height / 2 - 90,
      'SELECCIONA LA DURACIÓN',
      {
        fontFamily: 'Space Grotesk, Arial, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#aaaaaa',
      }
    );

    subtitle.setOrigin(0.5);

    this.durationUI.add(subtitle);

    // Botones
    const durations = [
      {
        seconds: 120,
        text: '2 MINUTOS',
      },
      {
        seconds: 180,
        text: '3 MINUTOS',
      },
      {
        seconds: 300,
        text: '5 MINUTOS',
      },
    ];

    durations.forEach((duration, index) => {
      const button = this.createDurationButton(
        width / 2,
        height / 2 + index * 75,
        duration.text,
        duration.seconds
      );

      this.durationUI.add(button);
    });
  }

  createDurationButton(x, y, text, seconds) {
    const width = 320;
    const height = 55;

    const container = this.add.container(x, y);

    container.setScrollFactor(0);

    const background = this.add.rectangle(
      0,
      0,
      width,
      height,
      0x151a2b
    );

    background.setStrokeStyle(
      2,
      0x00dbe7
    );

    const label = this.add.text(
      0,
      0,
      text,
      {
        fontFamily: 'Space Grotesk, Arial, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#e1fdff',
      }
    );

    label.setOrigin(0.5);

    container.add(background);
    container.add(label);

    container.setSize(width, height);

    container.setInteractive(
      new Phaser.Geom.Rectangle(
        -width / 2,
        -height / 2,
        width,
        height
      ),
      Phaser.Geom.Rectangle.Contains
    );

    container.on('pointerover', () => {
      background.setFillStyle(0x25345c);
      background.setStrokeStyle(3, 0x00dbe7);

      container.setScale(1.03);
    });

    container.on('pointerout', () => {
      background.setFillStyle(0x151a2b);
      background.setStrokeStyle(2, 0x00dbe7);

      container.setScale(1);
    });

    container.on('pointerdown', () => {
      this.selectDuration(seconds);
    });

    return container;
  }

  positionDurationUI() {
    if (!this.durationUI) {
      return;
    }

    // Como usamos coordenadas de pantalla,
    // actualizamos la posición de todos sus elementos.

    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;

    this.durationUI.each((child) => {
      child.setScrollFactor(0);
    });

    // El fondo
    if (this.durationUI.list[0]) {
      this.durationUI.list[0].setPosition(
        width / 2,
        height / 2
      );
    }

    // Título
    if (this.durationUI.list[1]) {
      this.durationUI.list[1].setPosition(
        width / 2,
        height / 2 - 170
      );
    }

    // Subtítulo
    if (this.durationUI.list[2]) {
      this.durationUI.list[2].setPosition(
        width / 2,
        height / 2 - 90
      );
    }

    // Botones
    for (let i = 3; i < this.durationUI.list.length; i++) {
      const buttonIndex = i - 3;

      this.durationUI.list[i].setPosition(
        width / 2,
        height / 2 + buttonIndex * 75
      );
    }
  }

  selectDuration(seconds) {
    console.log(
      'Duración seleccionada:',
      seconds,
      'segundos'
    );

    this.gameDuration = seconds;
    this.timeRemaining = seconds;

    if (this.durationUI) {
      this.durationUI.destroy(true);
      this.durationUI = null;
    }

    this.createTimer();

    this.startGame();
  }

  // =========================================================
  // CRONÓMETRO
  // =========================================================

  createTimer() {
    if (this.timerText) {
      this.timerText.destroy();
    }

    this.timerText = this.add.text(
      this.scale.gameSize.width / 2,
      45,
      this.formatTime(this.timeRemaining),
      {
        fontFamily: 'Space Grotesk, Arial, sans-serif',
        fontSize: '42px',
        fontStyle: 'bold',
        color: '#e1fdff',
        stroke: '#00dbe7',
        strokeThickness: 2,

        shadow: {
          color: '#00dbe7',
          blur: 15,
          fill: true,
        },
      }
    );

    this.timerText.setOrigin(0.5);

    this.timerText.setScrollFactor(0);

    this.timerText.setDepth(900);

    this.positionTimer();
  }

  positionTimer() {
    if (!this.timerText) {
      return;
    }

    this.timerText.setScrollFactor(0);

    this.timerText.setPosition(
      this.scale.gameSize.width / 2,
      45
    );
  }

  startTimer() {
    if (this.gameTimer) {
      this.gameTimer.remove(false);
    }

    this.gameTimer = this.time.addEvent({
      delay: 1000,
      loop: true,

      callback: () => {
        if (!this.gameActive) {
          return;
        }

        this.timeRemaining--;

        if (this.timeRemaining < 0) {
          this.timeRemaining = 0;
        }

        this.updateTimer();

        if (this.timeRemaining === 0) {
          this.endGame();
        }
      },
    });
  }

  updateTimer() {
    if (!this.timerText) {
      return;
    }

    this.timerText.setText(
      this.formatTime(this.timeRemaining)
    );

    if (this.timeRemaining <= 10) {
      this.timerText.setColor('#ff5555');
    } else {
      this.timerText.setColor('#e1fdff');
    }
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);

    const remainingSeconds = seconds % 60;

    return (
      String(minutes).padStart(2, '0') +
      ':' +
      String(remainingSeconds).padStart(2, '0')
    );
  }

  // =========================================================
  // INICIO DE PARTIDA
  // =========================================================

  startGame() {
    this.gameActive = true;
    this.roundActive = false;

    this.timeRemaining = this.gameDuration;

    this.updateTimer();

    // Iniciar reloj
    this.startTimer();

    // Primera ronda
    this.startRound();
  }

  startRound() {
    if (!this.gameActive) {
      return;
    }

    this.roundActive = false;

    this.physicsSystem?.setSimulationEnabled(false);

    this.puck.resetToCenter();

    this.puck.stop();

    // Tu Countdown original:
    // 3 → 2 → 1 → PONG
    this.countdown.start();
  }

  startSimulation() {
    if (!this.gameActive) {
      return;
    }

    if (this.timeRemaining <= 0) {
      return;
    }

    this.physicsSystem.setSimulationEnabled(true);

    this.roundActive = true;

    this.puck.launchRandom();
  }

  // =========================================================
  // GOLES
  // =========================================================

  checkGoals() {
    const scoredGoal =
      this.physicsSystem.findScoredGoal(this.puck);

    if (!scoredGoal) {
      return;
    }

    console.log(
      `Gol en porteria ${scoredGoal.side}`
    );

    // IMPORTANTE:
    // NO reiniciamos el cronómetro.

    this.startRound();
  }

  // =========================================================
  // FIN DE PARTIDA
  // =========================================================

  endGame() {
    if (!this.gameActive) {
      return;
    }

    console.log('FIN DE LA PARTIDA');

    this.gameActive = false;
    this.roundActive = false;

    this.physicsSystem?.setSimulationEnabled(false);

    this.puck?.stop();

    if (this.gameTimer) {
      this.gameTimer.remove(false);
      this.gameTimer = null;
    }

    this.timeRemaining = 0;

    this.updateTimer();

    this.time.delayedCall(500, () => {
      this.showGameOver();
    });
  }

  showGameOver() {
    const width = this.scale.gameSize.width;
    const height = this.scale.gameSize.height;

    this.gameOverUI = this.add.container(0, 0);

    this.gameOverUI.setScrollFactor(0);
    this.gameOverUI.setDepth(1000);

    const background = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x05070d,
      0.95
    );

    const title = this.add.text(
      width / 2,
      height / 2 - 70,
      'FIN DE LA PARTIDA',
      {
        fontFamily: 'Space Grotesk, Arial, sans-serif',
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#e1fdff',
        stroke: '#00dbe7',
        strokeThickness: 2,
      }
    );

    title.setOrigin(0.5);

    const duration = this.add.text(
      width / 2,
      height / 2,
      `Duración: ${this.formatTime(this.gameDuration)}`,
      {
        fontFamily: 'Space Grotesk, Arial, sans-serif',
        fontSize: '24px',
        color: '#aaaaaa',
      }
    );

    duration.setOrigin(0.5);

    const button = this.add.text(
      width / 2,
      height / 2 + 80,
      'NUEVA PARTIDA',
      {
        fontFamily: 'Arial',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#e1fdff',
        backgroundColor: '#151a2b',

        padding: {
          left: 30,
          right: 30,
          top: 15,
          bottom: 15,
        },
      }
    );

    button.setOrigin(0.5);

    button.setInteractive({
      useHandCursor: true,
    });

    button.on('pointerover', () => {
      button.setScale(1.05);
    });

    button.on('pointerout', () => {
      button.setScale(1);
    });

    button.on('pointerdown', () => {
      this.gameOverUI.destroy(true);
      this.gameOverUI = null;

      this.showDurationSelection();
    });

    this.gameOverUI.add([
      background,
      title,
      duration,
      button,
    ]);
  }
}