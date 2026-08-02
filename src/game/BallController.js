import Phaser from 'phaser';

const BALL_RADIUS = 14;
const WALL_THICKNESS = 18;
const MIN_SPEED = 270;
const MAX_SPEED = 360;

export class BallController {
  constructor(scene, board) {
    this.scene = scene;
    this.board = board;
    this.walls = scene.physics.add.staticGroup();
    this.ball = scene.add.circle(0, 0, BALL_RADIUS, 0xffffff, 1);

    scene.physics.add.existing(this.ball);
    this.ball.body
      .setCircle(BALL_RADIUS)
      .setBounce(1, 1)
      .setCollideWorldBounds(false)
      .setAllowGravity(false);

    scene.physics.add.collider(this.ball, this.walls);
    this.rebuildWalls();
    this.resetToCenter();
  }

  rebuildWalls() {
    this.walls.clear(true, true);

    const play = this.board.getWorldPlayBounds();
    const goals = this.board.getWorldGoals();
    const left = play.x;
    const right = play.x + play.width;
    const top = play.y;
    const bottom = play.y + play.height;

    this.addWall(left, top - WALL_THICKNESS / 2, goals.top.x - left, WALL_THICKNESS);
    this.addWall(goals.top.x + goals.top.width, top - WALL_THICKNESS / 2, right - (goals.top.x + goals.top.width), WALL_THICKNESS);

    this.addWall(left, bottom - WALL_THICKNESS / 2, goals.bottom.x - left, WALL_THICKNESS);
    this.addWall(goals.bottom.x + goals.bottom.width, bottom - WALL_THICKNESS / 2, right - (goals.bottom.x + goals.bottom.width), WALL_THICKNESS);

    this.addWall(left - WALL_THICKNESS / 2, top, WALL_THICKNESS, goals.left.y - top);
    this.addWall(left - WALL_THICKNESS / 2, goals.left.y + goals.left.height, WALL_THICKNESS, bottom - (goals.left.y + goals.left.height));

    this.addWall(right - WALL_THICKNESS / 2, top, WALL_THICKNESS, goals.right.y - top);
    this.addWall(right - WALL_THICKNESS / 2, goals.right.y + goals.right.height, WALL_THICKNESS, bottom - (goals.right.y + goals.right.height));

    this.walls.refresh();
  }

  addWall(x, y, width, height) {
    if (width <= 0 || height <= 0) {
      return;
    }

    const wall = this.scene.add.rectangle(x + width / 2, y + height / 2, width, height, 0xffffff, 0);
    this.scene.physics.add.existing(wall, true);
    this.walls.add(wall);
  }

  resetToCenter() {
    const play = this.board.getWorldPlayBounds();
    this.ball.setPosition(play.x + play.width / 2, play.y + play.height / 2);
    this.ball.body.reset(this.ball.x, this.ball.y);
    this.assignRandomVelocity();
  }

  assignRandomVelocity() {
    const speed = Phaser.Math.Between(MIN_SPEED, MAX_SPEED);
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const velocity = this.scene.physics.velocityFromRotation(angle, speed);

    this.ball.body.setVelocity(velocity.x, velocity.y);
    this.ensureMoving();
  }

  update() {
    this.ensureMoving();
    this.checkGoal();
  }

  ensureMoving() {
    const velocity = this.ball.body.velocity;
    const speed = velocity.length();

    if (speed < MIN_SPEED) {
      if (speed === 0) {
        this.assignRandomVelocity();
        return;
      }

      velocity.normalize().scale(MIN_SPEED);
      this.ball.body.setVelocity(velocity.x, velocity.y);
    }
  }

  checkGoal() {
    const play = this.board.getWorldPlayBounds();
    const goals = this.board.getWorldGoals();
    const ballBounds = this.ball.getBounds();

    if (ballBounds.bottom < play.y && this.isInsideHorizontalGoal(ballBounds, goals.top)) {
      this.scoreGoal('superior');
      return;
    }

    if (ballBounds.left > play.x + play.width && this.isInsideVerticalGoal(ballBounds, goals.right)) {
      this.scoreGoal('derecha');
      return;
    }

    if (ballBounds.top > play.y + play.height && this.isInsideHorizontalGoal(ballBounds, goals.bottom)) {
      this.scoreGoal('inferior');
      return;
    }

    if (ballBounds.right < play.x && this.isInsideVerticalGoal(ballBounds, goals.left)) {
      this.scoreGoal('izquierda');
    }
  }

  isInsideHorizontalGoal(ballBounds, goal) {
    return ballBounds.left >= goal.x && ballBounds.right <= goal.x + goal.width;
  }

  isInsideVerticalGoal(ballBounds, goal) {
    return ballBounds.top >= goal.y && ballBounds.bottom <= goal.y + goal.height;
  }

  scoreGoal(goalName) {
    console.log(`Gol en porteria ${goalName}`);
    this.resetToCenter();
  }
}
