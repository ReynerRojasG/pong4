import Phaser from 'phaser';
import { COLORS, PUCK } from './Constants.js';

export class Puck {
  constructor(scene, layout) {
    this.scene = scene;
    this.layout = layout;
    this.body = scene.add.circle(0, 0, PUCK.radius, COLORS.white, 1);

    scene.physics.add.existing(this.body);
    this.body.body
      .setCircle(PUCK.radius)
      .setBounce(1, 1)
      .setCollideWorldBounds(false)
      .setAllowGravity(false);

    this.resetToCenter();
    this.stop();
  }

  resetToCenter() {
    const play = this.layout.playArea;
    const x = play.x + play.width / 2;
    const y = play.y + play.height / 2;

    this.body.setPosition(x, y);
    this.body.body.reset(x, y);
  }

  launchRandom() {
    const speed = Phaser.Math.Between(PUCK.minSpeed, PUCK.maxSpeed);
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const velocity = this.scene.physics.velocityFromRotation(angle, speed);

    this.body.body.setVelocity(velocity.x, velocity.y);
    this.ensureMoving();
  }

  stop() {
    this.body.body.setVelocity(0, 0);
  }

  setPhysicsEnabled(enabled) {
    this.body.body.enable = enabled;

    if (!enabled) {
      this.stop();
    }
  }

  ensureMoving() {
    const velocity = this.body.body.velocity;
    const speed = velocity.length();

    if (speed < PUCK.minSpeed) {
      if (speed === 0) {
        this.launchRandom();
        return;
      }

      velocity.normalize().scale(PUCK.minSpeed);
      this.body.body.setVelocity(velocity.x, velocity.y);
    }
  }

  getBounds() {
    return this.body.getBounds();
  }
}
