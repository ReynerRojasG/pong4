import Phaser from 'phaser';
import { ArcadeBoard } from '../game/ArcadeBoard.js';
import { BallController } from '../game/BallController.js';
import { PlayerController } from '../game/PlayerController.js';

export class BoardScene extends Phaser.Scene {
  constructor() {
    super('BoardScene');

    // =====================================================
    // ESTADO DE LA PARTIDA
    // =====================================================

    this.gameActive = false;

    this.gameDuration = 0;
    this.timeRemaining = 0;
    this.gameTimer = null;

    // =====================================================
    // MARCADOR
    // =====================================================

    this.scores = {
      PC1: 0,
      PC2: 0,
      PC3: 0,
      PC4: 0,
    };

    // =====================================================
    // UI
    // =====================================================

    this.menuUI = null;
    this.timerText = null;
    this.countdownText = null;
    this.scoreUI = null;
    this.gameOverUI = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0e13');

    // =====================================================
    // TABLERO
    // =====================================================

    this.board = new ArcadeBoard(this);

    this.layoutBoard();

    // =====================================================
    // BOLA
    // =====================================================

    this.ballController = new BallController(
      this,
      this.board
    );

    // =====================================================
    // JUGADORES
    // =====================================================

    this.playerControllers = [
      new PlayerController(
        this,
        this.board,
        this.ballController,
        {
          side: 'left',
          color: 0x00dbe7,
          isControlled: true,
        }
      ),

      new PlayerController(
        this,
        this.board,
        this.ballController,
        {
          side: 'top',
          color: 0xe9c400,
        }
      ),

      new PlayerController(
        this,
        this.board,
        this.ballController,
        {
          side: 'right',
          color: 0x2ae500,
        }
      ),

      new PlayerController(
        this,
        this.board,
        this.ballController,
        {
          side: 'bottom',
          color: 0xff8a80,
        }
      ),
    ];

    this.gameActive = false;

    this.ballController.stop();

    // =====================================================
    // MENÚ INICIAL
    // =====================================================

    this.showDurationMenu();

    this.scale.on(
      'resize',
      this.layoutBoard,
      this
    );
  }

  update() {
    if (!this.gameActive) {
      return;
    }

    this.playerControllers.forEach(
      (playerController) => {
        playerController.update();
      }
    );

    this.ballController.update();
  }

  // =====================================================
  // TABLERO
  // =====================================================

  layoutBoard() {
    const {
      width,
      height,
    } = this.scale.gameSize;

    const margin =
      Math.min(width, height) * 0.08;

    const maxWidth =
      width - margin * 2;

    const maxHeight =
      height - margin * 2;

    const boardRatio = 4 / 3;

    let boardWidth = maxWidth;

    let boardHeight =
      boardWidth / boardRatio;

    if (boardHeight > maxHeight) {
      boardHeight = maxHeight;
      boardWidth =
        boardHeight * boardRatio;
    }

    this.board.container.setPosition(
      width / 2,
      height / 2
    );

    this.board.resize(
      boardWidth,
      boardHeight
    );

    this.ballController?.rebuildWalls();

    this.playerControllers?.forEach(
      (playerController) => {
        playerController.resetToZoneCenter();
      }
    );

    this.positionUI();
  }

  // =====================================================
  // MENÚ DE DURACIÓN
  // =====================================================

  showDurationMenu() {
    const {
      width,
      height,
    } = this.scale.gameSize;

    this.gameActive = false;

    this.ballController?.stop();

    this.menuUI =
      this.add.container(0, 0);

    this.menuUI.setDepth(1000);

    const background =
      this.add.rectangle(
        width / 2,
        height / 2,
        width,
        height,
        0x080b14,
        0.96
      );

    this.menuUI.add(background);

    const title =
      this.add.text(
        width / 2,
        height / 2 - 180,
        'PONG 4',
        {
          fontFamily:
            'Space Grotesk, Arial, sans-serif',

          fontSize: '64px',

          fontStyle: 'bold',

          color: '#e1fdff',

          stroke: '#00dbe7',

          strokeThickness: 2,
        }
      );

    title.setOrigin(0.5);

    this.menuUI.add(title);

    const subtitle =
      this.add.text(
        width / 2,
        height / 2 - 100,
        'SELECCIONA LA DURACIÓN',
        {
          fontFamily:
            'Space Grotesk, Arial, sans-serif',

          fontSize: '24px',

          fontStyle: 'bold',

          color: '#aaaaaa',
        }
      );

    subtitle.setOrigin(0.5);

    this.menuUI.add(subtitle);

    this.createDurationButton(
      width / 2,
      height / 2,
      '2 MINUTOS',
      120
    );

    this.createDurationButton(
      width / 2,
      height / 2 + 75,
      '3 MINUTOS',
      180
    );

    this.createDurationButton(
      width / 2,
      height / 2 + 150,
      '5 MINUTOS',
      300
    );
  }

  createDurationButton(
    x,
    y,
    text,
    seconds
  ) {
    const width = 320;
    const height = 55;

    const container =
      this.add.container(x, y);

    const background =
      this.add.rectangle(
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

    const label =
      this.add.text(
        0,
        0,
        text,
        {
          fontFamily:
            'Space Grotesk, Arial, sans-serif',

          fontSize: '22px',

          fontStyle: 'bold',

          color: '#e1fdff',
        }
      );

    label.setOrigin(0.5);

    container.add(background);
    container.add(label);

    container.setSize(
      width,
      height
    );

    container.setInteractive(
      new Phaser.Geom.Rectangle(
        -width / 2,
        -height / 2,
        width,
        height
      ),
      Phaser.Geom.Rectangle.Contains
    );

    container.on(
      'pointerover',
      () => {
        background.setFillStyle(
          0x25345c
        );

        background.setStrokeStyle(
          3,
          0x00dbe7
        );

        container.setScale(1.03);
      }
    );

    container.on(
      'pointerout',
      () => {
        background.setFillStyle(
          0x151a2b
        );

        background.setStrokeStyle(
          2,
          0x00dbe7
        );

        container.setScale(1);
      }
    );

    container.on(
      'pointerdown',
      () => {
        this.selectDuration(seconds);
      }
    );

    this.menuUI.add(container);
  }

  // =====================================================
  // SELECCIONAR DURACIÓN
  // =====================================================

  selectDuration(seconds) {
    this.gameDuration = seconds;
    this.timeRemaining = seconds;

    // Reiniciar marcador
    this.scores = {
      PC1: 0,
      PC2: 0,
      PC3: 0,
      PC4: 0,
    };

    if (this.menuUI) {
      this.menuUI.destroy(true);
      this.menuUI = null;
    }

    this.createTimer();

    this.createScoreUI();

    this.ballController.resetToCenter();

    this.ballController.stop();

    this.startCountdown();
  }

  // =====================================================
  // MARCADOR DURANTE LA PARTIDA
  // =====================================================

  createScoreUI() {
    if (this.scoreUI) {
      this.scoreUI.destroy(true);
    }

    this.scoreUI =
      this.add.container(0, 0);

    this.scoreUI.setDepth(900);

    // PC1 - izquierda
    this.pc1Text =
      this.add.text(
        35,
        this.scale.gameSize.height / 2,
        'PC1  0',
        this.getScoreStyle(
          '#00dbe7'
        )
      );

    this.pc1Text.setOrigin(
      0,
      0.5
    );

    // PC2 - arriba
    this.pc2Text =
      this.add.text(
        this.scale.gameSize.width / 2,
        75,
        'PC2  0',
        this.getScoreStyle(
          '#e9c400'
        )
      );

    this.pc2Text.setOrigin(
      0.5,
      0.5
    );

    // PC3 - derecha
    this.pc3Text =
      this.add.text(
        this.scale.gameSize.width - 35,
        this.scale.gameSize.height / 2,
        'PC3  0',
        this.getScoreStyle(
          '#2ae500'
        )
      );

    this.pc3Text.setOrigin(
      1,
      0.5
    );

    // PC4 - abajo
    this.pc4Text =
      this.add.text(
        this.scale.gameSize.width / 2,
        this.scale.gameSize.height - 45,
        'PC4  0',
        this.getScoreStyle(
          '#ff8a80'
        )
      );

    this.pc4Text.setOrigin(
      0.5,
      0.5
    );

    this.scoreUI.add([
      this.pc1Text,
      this.pc2Text,
      this.pc3Text,
      this.pc4Text,
    ]);
  }

  getScoreStyle(color) {
    return {
      fontFamily:
        'Space Grotesk, Arial, sans-serif',

      fontSize: '28px',

      fontStyle: 'bold',

      color,

      stroke: '#080b14',

      strokeThickness: 5,

      shadow: {
        color,
        blur: 12,
        fill: true,
      },
    };
  }

  // =====================================================
  // ACTUALIZAR MARCADOR
  // =====================================================

  updateScoreUI() {
    if (!this.pc1Text) {
      return;
    }

    this.pc1Text.setText(
      `PC1  ${this.scores.PC1}`
    );

    this.pc2Text.setText(
      `PC2  ${this.scores.PC2}`
    );

    this.pc3Text.setText(
      `PC3  ${this.scores.PC3}`
    );

    this.pc4Text.setText(
      `PC4  ${this.scores.PC4}`
    );
  }

  // =====================================================
  // REGISTRAR GOL
  // =====================================================

  onGoal(goalName) {
    if (!this.gameActive) {
      return;
    }

    let scoringPlayer = null;

    /*
      Si la bola entra por una portería,
      marca el jugador del lado contrario.
    */

    switch (goalName) {
      case 'superior':
        scoringPlayer = 'PC4';
        break;

      case 'derecha':
        scoringPlayer = 'PC1';
        break;

      case 'inferior':
        scoringPlayer = 'PC2';
        break;

      case 'izquierda':
        scoringPlayer = 'PC3';
        break;
    }

    if (!scoringPlayer) {
      return;
    }

    this.scores[scoringPlayer]++;

    console.log(
      `${scoringPlayer} anotó`
    );

    console.log(this.scores);

    this.updateScoreUI();

    // Mostrar brevemente quién anotó
    this.showGoalMessage(
      scoringPlayer
    );
  }

  // =====================================================
  // MENSAJE DE GOL
  // =====================================================

  showGoalMessage(player) {
    const {
      width,
      height,
    } = this.scale.gameSize;

    const message =
      this.add.text(
        width / 2,
        height / 2,
        `${player} ¡GOL!`,
        {
          fontFamily:
            'Space Grotesk, Arial, sans-serif',

          fontSize: '48px',

          fontStyle: 'bold',

          color: '#ffffff',

          stroke: '#00dbe7',

          strokeThickness: 3,
        }
      );

    message.setOrigin(0.5);

    message.setDepth(1200);

    message.setScale(0.5);

    message.setAlpha(0);

    this.tweens.add({
      targets: message,

      alpha: 1,

      scale: 1,

      duration: 180,

      ease: 'Back.easeOut',

      yoyo: true,

      hold: 450,

      onComplete: () => {
        message.destroy();
      },
    });
  }

  // =====================================================
  // CRONÓMETRO
  // =====================================================

  createTimer() {
    const {
      width,
    } = this.scale.gameSize;

    if (this.timerText) {
      this.timerText.destroy();
    }

    this.timerText =
      this.add.text(
        width / 2,
        40,
        this.formatTime(
          this.timeRemaining
        ),
        {
          fontFamily:
            'Space Grotesk, Arial, sans-serif',

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

    this.timerText.setDepth(900);
  }

  updateTimer() {
    if (!this.timerText) {
      return;
    }

    this.timerText.setText(
      this.formatTime(
        this.timeRemaining
      )
    );

    if (
      this.timeRemaining <= 10
    ) {
      this.timerText.setColor(
        '#ff5555'
      );
    } else {
      this.timerText.setColor(
        '#e1fdff'
      );
    }
  }

  startTimer() {
    if (this.gameTimer) {
      this.gameTimer.remove(false);
    }

    this.gameTimer =
      this.time.addEvent({
        delay: 1000,

        loop: true,

        callback: () => {
          if (!this.gameActive) {
            return;
          }

          this.timeRemaining--;

          if (
            this.timeRemaining < 0
          ) {
            this.timeRemaining = 0;
          }

          this.updateTimer();

          if (
            this.timeRemaining === 0
          ) {
            this.endGame();
          }
        },
      });
  }

  // =====================================================
  // COUNTDOWN
  // =====================================================

  startCountdown() {
    const {
      width,
      height,
    } = this.scale.gameSize;

    if (this.countdownText) {
      this.countdownText.destroy();
    }

    this.countdownText =
      this.add.text(
        width / 2,
        height / 2,
        '3',
        {
          fontFamily:
            'Space Grotesk, Arial, sans-serif',

          fontSize: '96px',

          fontStyle: 'bold',

          color: '#e1fdff',

          stroke: '#00dbe7',

          strokeThickness: 2,
        }
      );

    this.countdownText.setOrigin(0.5);

    this.countdownText.setDepth(1100);

    let number = 3;

    this.time.addEvent({
      delay: 1000,

      repeat: 2,

      callback: () => {
        number--;

        if (number > 0) {
          this.countdownText.setText(
            number.toString()
          );

          return;
        }

        this.countdownText.setText(
          'PONG'
        );

        this.time.delayedCall(
          500,
          () => {
            if (this.countdownText) {
              this.countdownText.destroy();

              this.countdownText = null;
            }

            this.startGame();
          }
        );
      },
    });
  }

  // =====================================================
  // INICIAR PARTIDA
  // =====================================================

  startGame() {
    console.log(
      'PARTIDA INICIADA'
    );

    this.gameActive = true;

    this.ballController.resetToCenter();

    this.ballController.launch();

    this.startTimer();
  }

  // =====================================================
  // FIN DE PARTIDA
  // =====================================================

  endGame() {
    if (!this.gameActive) {
      return;
    }

    console.log(
      'FIN DE LA PARTIDA'
    );

    this.gameActive = false;

    this.ballController.stop();

    if (this.gameTimer) {
      this.gameTimer.remove(false);

      this.gameTimer = null;
    }

    this.timeRemaining = 0;

    this.updateTimer();

    this.showGameOver();
  }

  // =====================================================
  // PANTALLA FINAL
  // =====================================================

  showGameOver() {
    const {
      width,
      height,
    } = this.scale.gameSize;

    this.gameOverUI =
      this.add.container(0, 0);

    this.gameOverUI.setDepth(1500);

    // Fondo oscuro
    const background =
      this.add.rectangle(
        width / 2,
        height / 2,
        width,
        height,
        0x070910,
        0.97
      );

    // =====================================================
    // TÍTULO
    // =====================================================

    const title =
      this.add.text(
        width / 2,
        90,
        'FIN DE LA PARTIDA',
        {
          fontFamily:
            'Space Grotesk, Arial, sans-serif',

          fontSize: '46px',

          fontStyle: 'bold',

          color: '#ffffff',

          stroke: '#00dbe7',

          strokeThickness: 2,
        }
      );

    title.setOrigin(0.5);

    // =====================================================
    // CALCULAR MVP
    // =====================================================

    const players = [
      {
        name: 'PC1',
        score: this.scores.PC1,
        color: '#00dbe7',
      },
      {
        name: 'PC2',
        score: this.scores.PC2,
        color: '#e9c400',
      },
      {
        name: 'PC3',
        score: this.scores.PC3,
        color: '#2ae500',
      },
      {
        name: 'PC4',
        score: this.scores.PC4,
        color: '#ff8a80',
      },
    ];

    players.sort(
      (a, b) =>
        b.score - a.score
    );

    const mvp = players[0];

    // =====================================================
    // MVP
    // =====================================================

    const mvpTitle =
      this.add.text(
        width / 2,
        165,
        '★ MVP ★',
        {
          fontFamily:
            'Space Grotesk, Arial, sans-serif',

          fontSize: '30px',

          fontStyle: 'bold',

          color: '#e9c400',
        }
      );

    mvpTitle.setOrigin(0.5);

    const mvpPlayer =
      this.add.text(
        width / 2,
        210,
        mvp.name,
        {
          fontFamily:
            'Space Grotesk, Arial, sans-serif',

          fontSize: '54px',

          fontStyle: 'bold',

          color: mvp.color,

          stroke: '#ffffff',

          strokeThickness: 1,
        }
      );

    mvpPlayer.setOrigin(0.5);

    const mvpGoals =
      this.add.text(
        width / 2,
        265,
        `${mvp.score} GOLES`,
        {
          fontFamily:
            'Space Grotesk, Arial, sans-serif',

          fontSize: '22px',

          fontStyle: 'bold',

          color: '#aaaaaa',
        }
      );

    mvpGoals.setOrigin(0.5);

    // =====================================================
    // ENCABEZADOS
    // =====================================================

    const header =
      this.add.text(
        width / 2,
        330,
        'JUGADOR                         GOLES',
        {
          fontFamily:
            'Space Grotesk, Arial, sans-serif',

          fontSize: '18px',

          fontStyle: 'bold',

          color: '#777777',
        }
      );

    header.setOrigin(0.5);

    // =====================================================
    // FILAS
    // =====================================================

    const rows = [];

    players.forEach(
      (player, index) => {
        const y =
          385 + index * 58;

        const rowBackground =
          this.add.rectangle(
            width / 2,
            y,
            520,
            48,
            index === 0
              ? 0x202c3d
              : 0x111722,
            0.95
          );

        rowBackground.setStrokeStyle(
          1,
          Phaser.Display.Color.HexStringToColor(
            player.color
          ).color,
          0.5
        );

        const position =
          this.add.text(
            width / 2 - 230,
            y,
            `${index + 1}`,
            {
              fontFamily:
                'Space Grotesk, Arial, sans-serif',

              fontSize: '20px',

              fontStyle: 'bold',

              color: '#777777',
            }
          );

        position.setOrigin(
          0.5
        );

        const name =
          this.add.text(
            width / 2 - 180,
            y,
            player.name,
            {
              fontFamily:
                'Space Grotesk, Arial, sans-serif',

              fontSize: '22px',

              fontStyle: 'bold',

              color: player.color,
            }
          );

        name.setOrigin(
          0,
          0.5
        );

        const goals =
          this.add.text(
            width / 2 + 190,
            y,
            player.score.toString(),
            {
              fontFamily:
                'Space Grotesk, Arial, sans-serif',

              fontSize: '24px',

              fontStyle: 'bold',

              color: '#ffffff',
            }
          );

        goals.setOrigin(
          0.5
        );

        rows.push(
          rowBackground,
          position,
          name,
          goals
        );
      }
    );

    // =====================================================
    // BOTÓN
    // =====================================================

    const button =
      this.add.text(
        width / 2,
        height - 75,
        'NUEVA PARTIDA',
        {
          fontFamily:
            'Space Grotesk, Arial, sans-serif',

          fontSize: '22px',

          fontStyle: 'bold',

          color: '#e1fdff',

          backgroundColor:
            '#151a2b',

          padding: {
            left: 35,
            right: 35,
            top: 14,
            bottom: 14,
          },
        }
      );

    button.setOrigin(0.5);

    button.setInteractive({
      useHandCursor: true,
    });

    button.on(
      'pointerover',
      () => {
        button.setScale(1.05);
      }
    );

    button.on(
      'pointerout',
      () => {
        button.setScale(1);
      }
    );

    button.on(
      'pointerdown',
      () => {
        this.startNewMatch();
      }
    );

    this.gameOverUI.add([
      background,
      title,
      mvpTitle,
      mvpPlayer,
      mvpGoals,
      header,
      ...rows,
      button,
    ]);
  }

  // =====================================================
  // NUEVA PARTIDA
  // =====================================================

  startNewMatch() {
    if (this.gameOverUI) {
      this.gameOverUI.destroy(true);

      this.gameOverUI = null;
    }

    if (this.timerText) {
      this.timerText.destroy();

      this.timerText = null;
    }

    if (this.scoreUI) {
      this.scoreUI.destroy(true);

      this.scoreUI = null;
    }

    this.showDurationMenu();
  }

  // =====================================================
  // FORMATEAR TIEMPO
  // =====================================================

  formatTime(seconds) {
    const minutes =
      Math.floor(seconds / 60);

    const remainingSeconds =
      seconds % 60;

    return (
      String(minutes).padStart(
        2,
        '0'
      ) +
      ':' +
      String(
        remainingSeconds
      ).padStart(2, '0')
    );
  }

  // =====================================================
  // POSICIÓN DE UI
  // =====================================================

  positionUI() {
    const {
      width,
      height,
    } = this.scale.gameSize;

    if (this.timerText) {
      this.timerText.setPosition(
        width / 2,
        40
      );
    }

    if (this.countdownText) {
      this.countdownText.setPosition(
        width / 2,
        height / 2
      );
    }

    if (this.pc1Text) {
      this.pc1Text.setPosition(
        35,
        height / 2
      );
    }

    if (this.pc2Text) {
      this.pc2Text.setPosition(
        width / 2,
        75
      );
    }

    if (this.pc3Text) {
      this.pc3Text.setPosition(
        width - 35,
        height / 2
      );
    }

    if (this.pc4Text) {
      this.pc4Text.setPosition(
        width / 2,
        height - 45
      );
    }
  }
}