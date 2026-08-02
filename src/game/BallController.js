import Phaser from 'phaser';

const BALL_RADIUS = 14;
const WALL_THICKNESS = 18;
const MIN_SPEED = 270;
const MAX_SPEED = 360;

export class BallController {
  constructor(scene, board) {
    this.scene = scene;
    this.board = board;

    // Paredes físicas
    this.walls = scene.physics.add.staticGroup();

    // Bola
    this.ball = scene.add.circle(
      0,
      0,
      BALL_RADIUS,
      0xffffff,
      1
    );

    // IMPORTANTE:
    // Colocamos la bola por encima del tablero.
    this.ball.setDepth(100);

    // Física de la bola
    scene.physics.add.existing(this.ball);

    this.ball.body
      .setCircle(BALL_RADIUS)
      .setBounce(1, 1)
      .setCollideWorldBounds(false)
      .setAllowGravity(false);

    // Colisión con paredes
    scene.physics.add.collider(
      this.ball,
      this.walls
    );

    this.rebuildWalls();

    // Colocar inicialmente en el centro
    this.resetToCenter();

    // Inicialmente detenemos la bola.
    // BoardScene la lanzará cuando termine el countdown.
    this.stop();
  }

  rebuildWalls() {
    this.walls.clear(true, true);

    const play =
      this.board.getWorldPlayBounds();

    const goals =
      this.board.getWorldGoals();

    const left = play.x;
    const right =
      play.x + play.width;

    const top = play.y;
    const bottom =
      play.y + play.height;

    // =====================================================
    // PARED SUPERIOR
    // =====================================================

    this.addWall(
      left,
      top - WALL_THICKNESS / 2,
      goals.top.x - left,
      WALL_THICKNESS
    );

    this.addWall(
      goals.top.x + goals.top.width,
      top - WALL_THICKNESS / 2,
      right -
        (goals.top.x + goals.top.width),
      WALL_THICKNESS
    );

    // =====================================================
    // PARED INFERIOR
    // =====================================================

    this.addWall(
      left,
      bottom - WALL_THICKNESS / 2,
      goals.bottom.x - left,
      WALL_THICKNESS
    );

    this.addWall(
      goals.bottom.x + goals.bottom.width,
      bottom - WALL_THICKNESS / 2,
      right -
        (goals.bottom.x + goals.bottom.width),
      WALL_THICKNESS
    );

    // =====================================================
    // PARED IZQUIERDA
    // =====================================================

    this.addWall(
      left - WALL_THICKNESS / 2,
      top,
      WALL_THICKNESS,
      goals.left.y - top
    );

    this.addWall(
      left - WALL_THICKNESS / 2,
      goals.left.y + goals.left.height,
      WALL_THICKNESS,
      bottom -
        (goals.left.y + goals.left.height)
    );

    // =====================================================
    // PARED DERECHA
    // =====================================================

    this.addWall(
      right - WALL_THICKNESS / 2,
      top,
      WALL_THICKNESS,
      goals.right.y - top
    );

    this.addWall(
      right - WALL_THICKNESS / 2,
      goals.right.y + goals.right.height,
      WALL_THICKNESS,
      bottom -
        (goals.right.y + goals.right.height)
    );

    this.walls.refresh();
  }

  addWall(x, y, width, height) {
    if (width <= 0 || height <= 0) {
      return;
    }

    const wall =
      this.scene.add.rectangle(
        x + width / 2,
        y + height / 2,
        width,
        height,
        0xffffff,
        0
      );

    this.scene.physics.add.existing(
      wall,
      true
    );

    this.walls.add(wall);
  }

  resetToCenter() {
    const play =
      this.board.getWorldPlayBounds();

    const centerX =
      play.x + play.width / 2;

    const centerY =
      play.y + play.height / 2;

    this.ball.setPosition(
      centerX,
      centerY
    );

    this.ball.body.reset(
      centerX,
      centerY
    );

    // Nos aseguramos de que siga visible
    this.ball.setVisible(true);

    this.ball.setDepth(100);
  }

  launch() {
    this.assignRandomVelocity();
  }

  stop() {
    if (!this.ball?.body) {
      return;
    }

    this.ball.body.setVelocity(0, 0);
  }

  assignRandomVelocity() {
    const speed =
      Phaser.Math.Between(
        MIN_SPEED,
        MAX_SPEED
      );

    const angle =
      Phaser.Math.FloatBetween(
        0,
        Math.PI * 2
      );

    const velocity =
      this.scene.physics.velocityFromRotation(
        angle,
        speed
      );

    this.ball.body.setVelocity(
      velocity.x,
      velocity.y
    );

    this.ensureMoving();
  }

  update() {
    this.ensureMoving();

    this.checkGoal();
  }

  ensureMoving() {
    if (!this.ball?.body) {
      return;
    }

    const velocity =
      this.ball.body.velocity;

    const speed =
      velocity.length();

    if (speed < MIN_SPEED) {
      if (speed === 0) {
        this.assignRandomVelocity();

        return;
      }

      velocity.normalize().scale(
        MIN_SPEED
      );

      this.ball.body.setVelocity(
        velocity.x,
        velocity.y
      );
    }
  }

  checkGoal() {
    const play =
      this.board.getWorldPlayBounds();

    const goals =
      this.board.getWorldGoals();

    const ballBounds =
      this.ball.getBounds();

    // Gol superior
    if (
      ballBounds.bottom < play.y &&
      this.isInsideHorizontalGoal(
        ballBounds,
        goals.top
      )
    ) {
      this.scoreGoal('superior');

      return;
    }

    // Gol derecha
    if (
      ballBounds.left >
        play.x + play.width &&
      this.isInsideVerticalGoal(
        ballBounds,
        goals.right
      )
    ) {
      this.scoreGoal('derecha');

      return;
    }

    // Gol inferior
    if (
      ballBounds.top >
        play.y + play.height &&
      this.isInsideHorizontalGoal(
        ballBounds,
        goals.bottom
      )
    ) {
      this.scoreGoal('inferior');

      return;
    }

    // Gol izquierda
    if (
      ballBounds.right < play.x &&
      this.isInsideVerticalGoal(
        ballBounds,
        goals.left
      )
    ) {
      this.scoreGoal('izquierda');
    }
  }

  isInsideHorizontalGoal(
    ballBounds,
    goal
  ) {
    return (
      ballBounds.left >= goal.x &&
      ballBounds.right <=
        goal.x + goal.width
    );
  }

  isInsideVerticalGoal(
    ballBounds,
    goal
  ) {
    return (
      ballBounds.top >= goal.y &&
      ballBounds.bottom <=
        goal.y + goal.height
    );
  }

scoreGoal(goalName) {
  console.log(`Gol en porteria ${goalName}`);

  // Avisamos a BoardScene qué portería recibió el gol.
  this.scene.onGoal?.(goalName);

  // Detenemos la bola.
  this.stop();

  // La devolvemos al centro.
  this.resetToCenter();

  // Esperamos un momento antes de volver a lanzarla.
  this.scene.time.delayedCall(700, () => {
    if (this.scene.gameActive) {
      this.launch();
    }
  });

    // Avisar a BoardScene
    // para que posteriormente
    // podamos sumar puntos.
    this.scene.onGoal?.(goalName);

    // Detener bola
    this.stop();

    // Volver al centro
    this.resetToCenter();

    // Lanzar otra vez después
    // de un pequeño momento.
    this.scene.time.delayedCall(
      400,
      () => {
        if (
          this.scene.gameActive
        ) {
          this.launch();
        }
      }
    );
  }
}