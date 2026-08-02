import Phaser from 'phaser';
import { ArcadeBoard } from '../game/ArcadeBoard.js';
import { BallController } from '../game/BallController.js';
import { PlayerController } from '../game/PlayerController.js';

export class BoardScene extends Phaser.Scene {
  constructor() {
    super('BoardScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0e13');

    this.board = new ArcadeBoard(this);
    this.layoutBoard();
    this.ballController = new BallController(this, this.board);
    this.playerControllers = [
      new PlayerController(this, this.board, this.ballController, {
        side: 'left',
        color: 0x00dbe7,
        isControlled: true,
      }),
      new PlayerController(this, this.board, this.ballController, {
        side: 'top',
        color: 0xe9c400,
      }),
      new PlayerController(this, this.board, this.ballController, {
        side: 'right',
        color: 0x2ae500,
      }),
      new PlayerController(this, this.board, this.ballController, {
        side: 'bottom',
        color: 0xff8a80,
      }),
    ];

    this.scale.on('resize', this.layoutBoard, this);
  }

  update() {
    this.playerControllers.forEach((playerController) => playerController.update());
    this.ballController.update();
  }

  layoutBoard() {
    const { width, height } = this.scale.gameSize;
    const margin = Math.min(width, height) * 0.08;
    const maxWidth = width - margin * 2;
    const maxHeight = height - margin * 2;
    const boardRatio = 4 / 3;

    let boardWidth = maxWidth;
    let boardHeight = boardWidth / boardRatio;

    if (boardHeight > maxHeight) {
      boardHeight = maxHeight;
      boardWidth = boardHeight * boardRatio;
    }

    this.board.container.setPosition(width / 2, height / 2);
    this.board.resize(boardWidth, boardHeight);
    this.ballController?.rebuildWalls();
    this.playerControllers?.forEach((playerController) => playerController.resetToZoneCenter());
  }
}
