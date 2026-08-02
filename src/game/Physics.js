import { Goal } from './Goal.js';
import { PHYSICS } from './Constants.js';

export class Physics {
  constructor(scene, layout) {
    this.scene = scene;
    this.layout = layout;
    this.walls = scene.physics.add.staticGroup();
    this.playerColliders = [];
  }

  rebuildWalls() {
    this.walls.clear(true, true);

    const play = this.layout.playArea;
    const goals = this.layout.goals;
    const left = play.x;
    const right = play.x + play.width;
    const top = play.y;
    const bottom = play.y + play.height;
    const wall = PHYSICS.wallThickness;

    this.addWall(left, top - wall / 2, goals.top.x - left, wall);
    this.addWall(goals.top.x + goals.top.width, top - wall / 2, right - (goals.top.x + goals.top.width), wall);

    this.addWall(left, bottom - wall / 2, goals.bottom.x - left, wall);
    this.addWall(goals.bottom.x + goals.bottom.width, bottom - wall / 2, right - (goals.bottom.x + goals.bottom.width), wall);

    this.addWall(left - wall / 2, top, wall, goals.left.y - top);
    this.addWall(left - wall / 2, goals.left.y + goals.left.height, wall, bottom - (goals.left.y + goals.left.height));

    this.addWall(right - wall / 2, top, wall, goals.right.y - top);
    this.addWall(right - wall / 2, goals.right.y + goals.right.height, wall, bottom - (goals.right.y + goals.right.height));

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

  bindPuck(puck) {
    this.puck = puck;
    this.scene.physics.add.collider(puck.body, this.walls);
  }

  bindPlayers(players) {
    this.playerColliders.forEach((collider) => collider.destroy());
    this.playerColliders = players.map((player) => this.scene.physics.add.collider(player.body, this.puck.body));
  }

  setSimulationEnabled(enabled) {
    this.scene.physics.world.isPaused = !enabled;
  }

  findScoredGoal(puck) {
    const play = this.layout.playArea;
    const bounds = puck.getBounds();

    return Object.values(this.layout.goals)
      .map((goalRect) => new Goal(goalRect.side, goalRect))
      .find((goal) => goal.isPastGoalLine(bounds, play));
  }
}
