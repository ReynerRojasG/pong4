import Phaser from 'phaser';

const PLAYER_RADIUS = 30;
const FOLLOW_LERP = 0.18;

export class PlayerController {
  constructor(scene, board, ballController, options) {
    this.scene = scene;
    this.board = board;
    this.ballController = ballController;
    this.side = options.side;
    this.color = options.color;
    this.isControlled = options.isControlled ?? false;

    this.glow = scene.add.circle(0, 0, PLAYER_RADIUS + 8, this.color, 0.18);
    this.disk = scene.add.circle(0, 0, PLAYER_RADIUS, this.color, 0.9);
    this.core = scene.add.circle(0, 0, PLAYER_RADIUS * 0.42, 0xffffff, 0.18);

    this.glow.setDepth(10);
    this.disk.setDepth(11);
    this.core.setDepth(12);

    scene.physics.add.existing(this.disk);
    this.disk.body
      .setCircle(PLAYER_RADIUS)
      .setImmovable(true)
      .setAllowGravity(false);

    scene.physics.add.collider(this.disk, ballController.ball);
    this.resetToZoneCenter();
  }

  resetToZoneCenter() {
    const zone = this.getMovementZone();
    this.moveTo(zone.x + zone.width / 2, zone.y + zone.height / 2);
  }

  update() {
    if (!this.isControlled) {
      return;
    }

    const pointer = this.scene.input.activePointer;
    const target = this.clampToZone(pointer.worldX, pointer.worldY);
    const nextX = Phaser.Math.Linear(this.disk.x, target.x, FOLLOW_LERP);
    const nextY = Phaser.Math.Linear(this.disk.y, target.y, FOLLOW_LERP);
    const clamped = this.clampToZone(nextX, nextY);

    this.moveTo(clamped.x, clamped.y);
  }

  getMovementZone() {
    return this.board.getWorldZones()[this.side];
  }

  clampToZone(x, y) {
    const zone = this.getMovementZone();

    return {
      x: Phaser.Math.Clamp(x, zone.x + PLAYER_RADIUS, zone.x + zone.width - PLAYER_RADIUS),
      y: Phaser.Math.Clamp(y, zone.y + PLAYER_RADIUS, zone.y + zone.height - PLAYER_RADIUS),
    };
  }

  moveTo(x, y) {
    this.glow.setPosition(x, y);
    this.disk.setPosition(x, y);
    this.core.setPosition(x, y);
    this.disk.body.reset(x, y);
  }
}
