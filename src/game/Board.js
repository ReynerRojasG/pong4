import { COLORS, SIDE_COLORS } from './Constants.js';

export class Board {
  constructor(scene, layout) {
    this.scene = scene;
    this.layout = layout;

    this.container = scene.add.container(0, 0);
    this.shadowLayer = scene.add.graphics();
    this.surfaceLayer = scene.add.graphics();
    this.gridLayer = scene.add.graphics();
    this.zoneLayer = scene.add.graphics();
    this.glowLayer = scene.add.graphics();
    this.lineLayer = scene.add.graphics();
    this.container.add([
      this.shadowLayer,
      this.surfaceLayer,
      this.gridLayer,
      this.zoneLayer,
      this.glowLayer,
      this.lineLayer,
    ]);

    this.draw();
  }

  draw() {
    this.clear();

    this.drawOuterGlow();
    this.drawTableSurface();
    this.drawGrid();
    this.drawPlayerZones();
    this.drawSharedCenter();
    this.drawZoneBoundaries();
    this.drawGoals();
    this.drawNeonBorders();
  }

  clear() {
    this.shadowLayer.clear();
    this.surfaceLayer.clear();
    this.gridLayer.clear();
    this.zoneLayer.clear();
    this.glowLayer.clear();
    this.lineLayer.clear();
  }

  drawOuterGlow() {
    const table = this.layout.table;
    const { cornerRadius } = this.layout.metrics;

    this.shadowLayer.fillStyle(COLORS.shadow, 0.42);
    this.shadowLayer.fillRoundedRect(table.x + 18, table.y + 24, table.width, table.height, cornerRadius);

    this.shadowLayer.lineStyle(28, COLORS.grid, 0.03);
    this.shadowLayer.strokeRoundedRect(table.x - 8, table.y - 8, table.width + 16, table.height + 16, cornerRadius + 8);

    this.shadowLayer.lineStyle(12, COLORS.grid, 0.05);
    this.shadowLayer.strokeRoundedRect(table.x + 2, table.y + 2, table.width - 4, table.height - 4, cornerRadius);
  }

  drawTableSurface() {
    const table = this.layout.table;
    const { cornerRadius } = this.layout.metrics;

    this.surfaceLayer.fillStyle(COLORS.tablePanel, 0.84);
    this.surfaceLayer.fillRoundedRect(table.x, table.y, table.width, table.height, cornerRadius);

    this.surfaceLayer.fillStyle(COLORS.table, 0.96);
    this.surfaceLayer.fillRoundedRect(
      table.x + 12,
      table.y + 12,
      table.width - 24,
      table.height - 24,
      cornerRadius - 10,
    );

    this.surfaceLayer.lineStyle(6, COLORS.borderDim, 0.45);
    this.surfaceLayer.strokeRoundedRect(table.x + 8, table.y + 8, table.width - 16, table.height - 16, cornerRadius - 8);
  }

  drawGrid() {
    const play = this.layout.playArea;
    const { gridSize } = this.layout.metrics;
    const xEnd = play.x + play.width;
    const yEnd = play.y + play.height;

    this.gridLayer.lineStyle(1, COLORS.grid, 0.065);

    for (let x = play.x; x <= xEnd; x += gridSize) {
      this.gridLayer.lineBetween(x, play.y, x, yEnd);
    }

    for (let y = play.y; y <= yEnd; y += gridSize) {
      this.gridLayer.lineBetween(play.x, y, xEnd, y);
    }
  }

  drawPlayerZones() {
    const { top, right, bottom, left } = this.layout.zones;

    this.zoneLayer.fillStyle(SIDE_COLORS.top, 0.055);
    this.zoneLayer.fillRect(top.x, top.y, top.width, top.height);

    this.zoneLayer.fillStyle(SIDE_COLORS.right, 0.055);
    this.zoneLayer.fillRect(right.x, right.y, right.width, right.height);

    this.zoneLayer.fillStyle(SIDE_COLORS.bottom, 0.055);
    this.zoneLayer.fillRect(bottom.x, bottom.y, bottom.width, bottom.height);

    this.zoneLayer.fillStyle(SIDE_COLORS.left, 0.055);
    this.zoneLayer.fillRect(left.x, left.y, left.width, left.height);
  }

  drawSharedCenter() {
    const center = this.layout.zones.center;

    this.zoneLayer.fillStyle(COLORS.white, 0.025);
    this.zoneLayer.fillRoundedRect(center.x, center.y, center.width, center.height, 22);

    this.glowLayer.lineStyle(18, COLORS.center, 0.025);
    this.glowLayer.strokeRoundedRect(center.x, center.y, center.width, center.height, 22);

    this.lineLayer.lineStyle(2, COLORS.center, 0.22);
    this.lineLayer.strokeRoundedRect(center.x, center.y, center.width, center.height, 22);
  }

  drawZoneBoundaries() {
    const center = this.layout.zones.center;
    const innerLeft = center.x;
    const innerRight = center.x + center.width;
    const innerTop = center.y;
    const innerBottom = center.y + center.height;

    this.drawDashedLine(innerLeft, innerTop, innerRight, innerTop, SIDE_COLORS.top, 0.42);
    this.drawDashedLine(innerRight, innerTop, innerRight, innerBottom, SIDE_COLORS.right, 0.42);
    this.drawDashedLine(innerLeft, innerBottom, innerRight, innerBottom, SIDE_COLORS.bottom, 0.42);
    this.drawDashedLine(innerLeft, innerTop, innerLeft, innerBottom, SIDE_COLORS.left, 0.42);

    this.glowLayer.lineStyle(16, SIDE_COLORS.top, 0.035);
    this.glowLayer.lineBetween(innerLeft, innerTop, innerRight, innerTop);
    this.glowLayer.lineStyle(16, SIDE_COLORS.right, 0.035);
    this.glowLayer.lineBetween(innerRight, innerTop, innerRight, innerBottom);
    this.glowLayer.lineStyle(16, SIDE_COLORS.bottom, 0.035);
    this.glowLayer.lineBetween(innerLeft, innerBottom, innerRight, innerBottom);
    this.glowLayer.lineStyle(16, SIDE_COLORS.left, 0.035);
    this.glowLayer.lineBetween(innerLeft, innerTop, innerLeft, innerBottom);
  }

  drawGoals() {
    Object.values(this.layout.goals).forEach((goal) => this.drawGoal(goal));
  }

  drawGoal(goal) {
    const color = SIDE_COLORS[goal.side];
    const radius = 10;

    this.glowLayer.fillStyle(color, 0.08);
    this.glowLayer.fillRoundedRect(goal.x, goal.y, goal.width, goal.height, radius);

    this.glowLayer.lineStyle(18, color, 0.08);
    this.glowLayer.strokeRoundedRect(goal.x, goal.y, goal.width, goal.height, radius);

    this.lineLayer.fillStyle(color, 0.08);
    this.lineLayer.fillRoundedRect(goal.x, goal.y, goal.width, goal.height, radius);

    this.lineLayer.lineStyle(4, color, 0.82);
    this.lineLayer.strokeRoundedRect(goal.x, goal.y, goal.width, goal.height, radius);

    this.lineLayer.lineStyle(2, COLORS.white, 0.2);
    this.lineLayer.strokeRoundedRect(goal.x + 7, goal.y + 7, goal.width - 14, goal.height - 14, 7);
  }

  drawNeonBorders() {
    const table = this.layout.table;
    const play = this.layout.playArea;
    const { cornerRadius } = this.layout.metrics;

    this.glowLayer.lineStyle(20, COLORS.grid, 0.08);
    this.glowLayer.strokeRoundedRect(table.x + 14, table.y + 14, table.width - 28, table.height - 28, cornerRadius - 12);

    this.lineLayer.lineStyle(2, COLORS.grid, 0.9);
    this.lineLayer.strokeRoundedRect(play.x, play.y, play.width, play.height, 24);

    this.lineLayer.lineStyle(1, COLORS.white, 0.16);
    this.lineLayer.strokeRoundedRect(play.x + 9, play.y + 9, play.width - 18, play.height - 18, 18);
  }

  drawDashedLine(x1, y1, x2, y2, color, alpha) {
    const dashLength = 16;
    const gapLength = 12;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.floor(distance / (dashLength + gapLength));
    const unitX = dx / distance;
    const unitY = dy / distance;

    this.lineLayer.lineStyle(2, color, alpha);

    for (let i = 0; i <= steps; i += 1) {
      const start = i * (dashLength + gapLength);
      const end = Math.min(start + dashLength, distance);
      this.lineLayer.lineBetween(
        x1 + unitX * start,
        y1 + unitY * start,
        x1 + unitX * end,
        y1 + unitY * end,
      );
    }
  }
}
