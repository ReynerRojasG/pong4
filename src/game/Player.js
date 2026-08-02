import Phaser from 'phaser';
import { COLORS, PLAYER } from './Constants.js';

export class Player {
  constructor(scene, layout, options) {
    this.scene = scene;
    this.layout = layout;
    this.index = options.index;
    this.side = options.side;
    this.color = options.color;
    this.isControlled = options.isControlled ?? false;
    this.getTargetPoint = options.getTargetPoint;
    this.canMove = options.canMove ?? (() => true);

    this.glow = scene.add.circle(0, 0, PLAYER.radius + 8, this.color, 0.18);
    this.body = scene.add.circle(0, 0, PLAYER.radius, this.color, 0.9);
    this.core = scene.add.circle(0, 0, PLAYER.radius * 0.42, COLORS.white, 0.18);

    this.glow.setDepth(10);
    this.body.setDepth(11);
    this.core.setDepth(12);

    scene.physics.add.existing(this.body);
    this.body.body
      .setCircle(PLAYER.radius)
      .setImmovable(true)
      .setAllowGravity(false);

    this.resetToZoneCenter();
  }

  resetToZoneCenter() {
    const zone = this.getMovementZone();
    this.moveTo(zone.x + zone.width / 2, zone.y + zone.height / 2);
  }

  update() {
    if (!this.isControlled || !this.canMove()) {
      return;
    }

    const target = this.clampToZonePoint(this.getTargetPoint());
    const nextX = Phaser.Math.Linear(this.body.x, target.x, PLAYER.followLerp);
    const nextY = Phaser.Math.Linear(this.body.y, target.y, PLAYER.followLerp);
    const clamped = this.clampToZone(nextX, nextY);

    this.moveTo(clamped.x, clamped.y);
  }

  getMovementZone() {
    return this.layout.zones[this.side];
  }

  clampToZonePoint(point) {
    return this.clampToZone(point.x, point.y);
  }

  clampToZone(x, y) {
    const zone = this.getMovementZone();

    return {
      x: Phaser.Math.Clamp(x, zone.x + PLAYER.radius, zone.x + zone.width - PLAYER.radius),
      y: Phaser.Math.Clamp(y, zone.y + PLAYER.radius, zone.y + zone.height - PLAYER.radius),
    };
  }

  moveTo(x, y) {
    this.glow.setPosition(x, y);
    this.body.setPosition(x, y);
    this.core.setPosition(x, y);
    this.body.body.reset(x, y);
  }
}
