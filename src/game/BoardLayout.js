import { BOARD } from './Constants.js';

export class BoardLayout {
  constructor(options = {}) {
    this.options = {
      width: 1000,
      height: 750,
      centerX: 0,
      centerY: 0,
      ...options,
    };

    this.update(this.options);
  }

  update(options) {
    this.options = { ...this.options, ...options };

    const reference = Math.min(this.options.width, this.options.height);
    this.metrics = {
      padding: reference * BOARD.paddingRatio,
      cornerRadius: reference * BOARD.cornerRadiusRatio,
      goalWidth: reference * BOARD.goalWidthRatio,
      goalDepth: reference * BOARD.goalDepthRatio,
      gridSize: BOARD.gridSize,
    };
  }

  get table() {
    return {
      x: this.options.centerX - this.options.width / 2,
      y: this.options.centerY - this.options.height / 2,
      width: this.options.width,
      height: this.options.height,
    };
  }

  get playArea() {
    const { padding } = this.metrics;
    const table = this.table;

    return {
      x: table.x + padding,
      y: table.y + padding,
      width: table.width - padding * 2,
      height: table.height - padding * 2,
    };
  }

  get zones() {
    const play = this.playArea;
    const horizontalDepth = play.height * BOARD.zoneRatio;
    const verticalDepth = play.width * BOARD.zoneRatio;
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

  get goals() {
    const play = this.playArea;
    const { goalWidth, goalDepth } = this.metrics;
    const centerX = play.x + play.width / 2;
    const centerY = play.y + play.height / 2;

    return {
      top: {
        side: 'top',
        x: centerX - goalWidth / 2,
        y: play.y,
        width: goalWidth,
        height: goalDepth,
      },
      right: {
        side: 'right',
        x: play.x + play.width - goalDepth,
        y: centerY - goalWidth / 2,
        width: goalDepth,
        height: goalWidth,
      },
      bottom: {
        side: 'bottom',
        x: centerX - goalWidth / 2,
        y: play.y + play.height - goalDepth,
        width: goalWidth,
        height: goalDepth,
      },
      left: {
        side: 'left',
        x: play.x,
        y: centerY - goalWidth / 2,
        width: goalDepth,
        height: goalWidth,
      },
    };
  }

  get center() {
    return {
      x: this.options.centerX,
      y: this.options.centerY,
    };
  }
}
