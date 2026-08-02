const COLORS = {
  background: 0x0d0e13,
  table: 0x121318,
  tablePanel: 0x1a1b21,
  borderDim: 0x3a494b,
  grid: 0x00dbe7,
  center: 0xe3e1e9,
  blue: 0x00dbe7,
  yellow: 0xe9c400,
  green: 0x2ae500,
  red: 0xff8a80,
};

const SIDE_COLORS = {
  top: COLORS.yellow,
  right: COLORS.green,
  bottom: COLORS.red,
  left: COLORS.blue,
};

export class ArcadeBoard {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = {
      width: 1000,
      height: 750,
      cornerRadius: 42,
      padding: 34,
      zoneRatio: 0.2,
      goalWidth: 230,
      goalDepth: 34,
      gridSize: 32,
      ...options,
    };

    this.container = scene.add.container(0, 0);
    this.shadowLayer = scene.add.graphics();
    this.surfaceLayer = scene.add.graphics();
    this.gridLayer = scene.add.graphics();
    this.zoneLayer = scene.add.graphics();
    this.lineLayer = scene.add.graphics();
    this.glowLayer = scene.add.graphics();
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

  resize(width, height) {
    this.options.width = width;
    this.options.height = height;
    this.options.goalWidth = Math.min(width, height) * 0.3;
    this.options.goalDepth = Math.min(width, height) * 0.045;
    this.options.padding = Math.min(width, height) * 0.045;
    this.options.cornerRadius = Math.min(width, height) * 0.055;
    this.draw();
  }

  draw() {
    this.clear();

    const table = this.getTableBounds();
    const play = this.getPlayBounds();

    this.drawOuterGlow(table);
    this.drawTableSurface(table);
    this.drawGrid(play);
    this.drawPlayerZones(play);
    this.drawSharedCenter(play);
    this.drawZoneBoundaries(play);
    this.drawGoals(play);
    this.drawNeonBorders(table, play);
  }

  getTableBounds() {
    const { width, height } = this.options;
    return {
      x: -width / 2,
      y: -height / 2,
      width,
      height,
    };
  }

  getPlayBounds() {
    const { padding, width, height } = this.options;
    return {
      x: -width / 2 + padding,
      y: -height / 2 + padding,
      width: width - padding * 2,
      height: height - padding * 2,
    };
  }

  getWorldPlayBounds() {
    return this.toWorldRect(this.getPlayBounds());
  }

  getLocalZones() {
    const play = this.getPlayBounds();
    const { zoneRatio } = this.options;
    const horizontalDepth = play.height * zoneRatio;
    const verticalDepth = play.width * zoneRatio;
    const centerWidth = play.width - verticalDepth * 2;
    const centerHeight = play.height - horizontalDepth * 2;

    return {
      top: {
        x: play.x + verticalDepth,
        y: play.y,
        width: centerWidth,
        height: horizontalDepth,
      },
      right: {
        x: play.x + play.width - verticalDepth,
        y: play.y + horizontalDepth,
        width: verticalDepth,
        height: centerHeight,
      },
      bottom: {
        x: play.x + verticalDepth,
        y: play.y + play.height - horizontalDepth,
        width: centerWidth,
        height: horizontalDepth,
      },
      left: {
        x: play.x,
        y: play.y + horizontalDepth,
        width: verticalDepth,
        height: centerHeight,
      },
      center: {
        x: play.x + verticalDepth,
        y: play.y + horizontalDepth,
        width: centerWidth,
        height: centerHeight,
      },
    };
  }

  getWorldZones() {
    const zones = this.getLocalZones();

    return Object.fromEntries(
      Object.entries(zones).map(([name, zone]) => [name, this.toWorldRect(zone)]),
    );
  }

  getWorldGoals() {
    const play = this.getPlayBounds();
    const { goalWidth, goalDepth } = this.options;
    const centerX = play.x + play.width / 2;
    const centerY = play.y + play.height / 2;
    const right = play.x + play.width;
    const bottom = play.y + play.height;

    return {
      top: this.toWorldRect({
        x: centerX - goalWidth / 2,
        y: play.y,
        width: goalWidth,
        height: goalDepth,
      }),
      right: this.toWorldRect({
        x: right - goalDepth,
        y: centerY - goalWidth / 2,
        width: goalDepth,
        height: goalWidth,
      }),
      bottom: this.toWorldRect({
        x: centerX - goalWidth / 2,
        y: bottom - goalDepth,
        width: goalWidth,
        height: goalDepth,
      }),
      left: this.toWorldRect({
        x: play.x,
        y: centerY - goalWidth / 2,
        width: goalDepth,
        height: goalWidth,
      }),
    };
  }

  toWorldRect(rect) {
    return {
      x: this.container.x + rect.x,
      y: this.container.y + rect.y,
      width: rect.width,
      height: rect.height,
    };
  }

  clear() {
    this.shadowLayer.clear();
    this.surfaceLayer.clear();
    this.gridLayer.clear();
    this.zoneLayer.clear();
    this.lineLayer.clear();
    this.glowLayer.clear();
  }

  drawOuterGlow(table) {
    const { cornerRadius } = this.options;

    this.shadowLayer.fillStyle(0x000000, 0.42);
    this.shadowLayer.fillRoundedRect(table.x + 18, table.y + 24, table.width, table.height, cornerRadius);

    this.shadowLayer.lineStyle(28, COLORS.grid, 0.03);
    this.shadowLayer.strokeRoundedRect(table.x - 8, table.y - 8, table.width + 16, table.height + 16, cornerRadius + 8);

    this.shadowLayer.lineStyle(12, COLORS.grid, 0.05);
    this.shadowLayer.strokeRoundedRect(table.x + 2, table.y + 2, table.width - 4, table.height - 4, cornerRadius);
  }

  drawTableSurface(table) {
    const { cornerRadius } = this.options;

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

  drawGrid(play) {
    const { gridSize } = this.options;
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

  drawPlayerZones(play) {
    const zones = this.getLocalZones();

    this.zoneLayer.fillStyle(SIDE_COLORS.top, 0.055);
    this.zoneLayer.fillRect(zones.top.x, zones.top.y, zones.top.width, zones.top.height);

    this.zoneLayer.fillStyle(SIDE_COLORS.right, 0.055);
    this.zoneLayer.fillRect(zones.right.x, zones.right.y, zones.right.width, zones.right.height);

    this.zoneLayer.fillStyle(SIDE_COLORS.bottom, 0.055);
    this.zoneLayer.fillRect(zones.bottom.x, zones.bottom.y, zones.bottom.width, zones.bottom.height);

    this.zoneLayer.fillStyle(SIDE_COLORS.left, 0.055);
    this.zoneLayer.fillRect(zones.left.x, zones.left.y, zones.left.width, zones.left.height);
  }

  drawSharedCenter(play) {
    const center = this.getLocalZones().center;

    this.zoneLayer.fillStyle(0xffffff, 0.025);
    this.zoneLayer.fillRoundedRect(center.x, center.y, center.width, center.height, 22);

    this.glowLayer.lineStyle(18, COLORS.center, 0.025);
    this.glowLayer.strokeRoundedRect(center.x, center.y, center.width, center.height, 22);

    this.lineLayer.lineStyle(2, COLORS.center, 0.22);
    this.lineLayer.strokeRoundedRect(center.x, center.y, center.width, center.height, 22);
  }

  drawZoneBoundaries(play) {
    const center = this.getLocalZones().center;
    const innerLeft = center.x;
    const innerRight = center.x + center.width;
    const innerTop = center.y;
    const innerBottom = center.y + center.height;

    this.drawDashedLine(this.lineLayer, innerLeft, innerTop, innerRight, innerTop, SIDE_COLORS.top, 0.42);
    this.drawDashedLine(this.lineLayer, innerRight, innerTop, innerRight, innerBottom, SIDE_COLORS.right, 0.42);
    this.drawDashedLine(this.lineLayer, innerLeft, innerBottom, innerRight, innerBottom, SIDE_COLORS.bottom, 0.42);
    this.drawDashedLine(this.lineLayer, innerLeft, innerTop, innerLeft, innerBottom, SIDE_COLORS.left, 0.42);

    this.glowLayer.lineStyle(16, SIDE_COLORS.top, 0.035);
    this.glowLayer.lineBetween(innerLeft, innerTop, innerRight, innerTop);
    this.glowLayer.lineStyle(16, SIDE_COLORS.right, 0.035);
    this.glowLayer.lineBetween(innerRight, innerTop, innerRight, innerBottom);
    this.glowLayer.lineStyle(16, SIDE_COLORS.bottom, 0.035);
    this.glowLayer.lineBetween(innerLeft, innerBottom, innerRight, innerBottom);
    this.glowLayer.lineStyle(16, SIDE_COLORS.left, 0.035);
    this.glowLayer.lineBetween(innerLeft, innerTop, innerLeft, innerBottom);
  }

  drawGoals(play) {
    const { goalWidth, goalDepth } = this.options;
    const centerX = play.x + play.width / 2;
    const centerY = play.y + play.height / 2;
    const right = play.x + play.width;
    const bottom = play.y + play.height;

    this.drawGoal(centerX - goalWidth / 2, play.y, goalWidth, goalDepth, 'top');
    this.drawGoal(right - goalDepth, centerY - goalWidth / 2, goalDepth, goalWidth, 'right');
    this.drawGoal(centerX - goalWidth / 2, bottom - goalDepth, goalWidth, goalDepth, 'bottom');
    this.drawGoal(play.x, centerY - goalWidth / 2, goalDepth, goalWidth, 'left');
  }

  drawGoal(x, y, width, height, side) {
    const color = SIDE_COLORS[side];

    this.glowLayer.fillStyle(color, 0.08);
    this.glowLayer.fillRoundedRect(x, y, width, height, 10);

    this.glowLayer.lineStyle(18, color, 0.08);
    this.glowLayer.strokeRoundedRect(x, y, width, height, 10);

    this.lineLayer.fillStyle(color, 0.08);
    this.lineLayer.fillRoundedRect(x, y, width, height, 10);

    this.lineLayer.lineStyle(4, color, 0.82);
    this.lineLayer.strokeRoundedRect(x, y, width, height, 10);

    this.lineLayer.lineStyle(2, 0xffffff, 0.2);
    this.lineLayer.strokeRoundedRect(x + 7, y + 7, width - 14, height - 14, 7);
  }

  drawNeonBorders(table, play) {
    const { cornerRadius } = this.options;

    this.glowLayer.lineStyle(20, COLORS.grid, 0.08);
    this.glowLayer.strokeRoundedRect(table.x + 14, table.y + 14, table.width - 28, table.height - 28, cornerRadius - 12);

    this.lineLayer.lineStyle(2, COLORS.grid, 0.9);
    this.lineLayer.strokeRoundedRect(play.x, play.y, play.width, play.height, 24);

    this.lineLayer.lineStyle(1, 0xffffff, 0.16);
    this.lineLayer.strokeRoundedRect(play.x + 9, play.y + 9, play.width - 18, play.height - 18, 18);
  }

  drawDashedLine(graphics, x1, y1, x2, y2, color, alpha) {
    const dashLength = 16;
    const gapLength = 12;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.floor(distance / (dashLength + gapLength));
    const unitX = dx / distance;
    const unitY = dy / distance;

    graphics.lineStyle(2, color, alpha);

    for (let i = 0; i <= steps; i += 1) {
      const start = i * (dashLength + gapLength);
      const end = Math.min(start + dashLength, distance);
      graphics.lineBetween(
        x1 + unitX * start,
        y1 + unitY * start,
        x1 + unitX * end,
        y1 + unitY * end,
      );
    }
  }
}
