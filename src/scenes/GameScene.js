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
    this.countdown = new Countdown(this, this.cameraManager, () => this.startSimulation());

    this.physicsSystem.rebuildWalls();
    this.physicsSystem.bindPuck(this.puck);
    this.physicsSystem.bindPlayers(this.players);
    this.layoutScene();
    this.startRound();

    this.scale.on('resize', this.layoutScene, this);
  }

  update() {
    if (!this.roundActive) {
      return;
    }

    this.players.forEach((player) => player.update());
    this.puck.ensureMoving();
    this.checkGoals();
  }

  createPlayers() {
    return PLAYERS.map((playerConfig) => new Player(this, this.layout, {
      ...playerConfig,
      getTargetPoint: () => this.getLocalPointerWorldPoint(),
      canMove: () => this.roundActive,
    }));
  }

  getLocalPointerWorldPoint() {
    const pointer = this.input.activePointer;

    return this.cameraManager.screenToWorld(pointer.x, pointer.y);
  }

  layoutScene() {
    this.layout.update(this.getBoardSize());
    this.board.draw();
    this.cameraManager.resize(this.scale.gameSize.width, this.scale.gameSize.height);
    this.physicsSystem?.rebuildWalls();
    this.puck?.resetToCenter();
    this.players?.forEach((player) => player.resetToZoneCenter());
    this.countdown?.placeLabel();
  }

  getBoardSize() {
    return {
      centerX: 0,
      centerY: 0,
      width: 1000,
      height: 1000 / BOARD.aspectRatio,
    };
  }

  startRound() {
    this.roundActive = false;
    this.physicsSystem?.setSimulationEnabled(false);
    this.puck.resetToCenter();
    this.puck.stop();
    this.countdown?.start();
  }

  startSimulation() {
    this.physicsSystem.setSimulationEnabled(true);
    this.roundActive = true;
    this.puck.launchRandom();
  }

  checkGoals() {
    const scoredGoal = this.physicsSystem.findScoredGoal(this.puck);

    if (!scoredGoal) {
      return;
    }

    console.log(`Gol en porteria ${scoredGoal.side}`);
    this.startRound();
  }
}
