export class Goal {
  constructor(side, rect) {
    this.side = side;
    this.rect = rect;
  }

  containsCircleBounds(bounds) {
    if (this.side === 'top' || this.side === 'bottom') {
      return bounds.left >= this.rect.x && bounds.right <= this.rect.x + this.rect.width;
    }

    return bounds.top >= this.rect.y && bounds.bottom <= this.rect.y + this.rect.height;
  }

  isPastGoalLine(bounds, playArea) {
    const goalLineChecks = {
      top: bounds.bottom < playArea.y,
      right: bounds.left > playArea.x + playArea.width,
      bottom: bounds.top > playArea.y + playArea.height,
      left: bounds.right < playArea.x,
    };

    return goalLineChecks[this.side] && this.containsCircleBounds(bounds);
  }
}
