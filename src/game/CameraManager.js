import Phaser from 'phaser';
import { BOARD, CAMERA_ROTATION_BY_SIDE, PLAYER_SIDE_BY_INDEX } from './Constants.js';

export class CameraManager {
  constructor(scene, layout, options = {}) {
    this.scene = scene;
    this.layout = layout;
    this.localPlayerIndex = options.localPlayerIndex ?? 1;
    this.camera = scene.cameras.main;
  }

  resize(width, height) {
    this.viewport = { width, height };
    this.camera.setViewport(0, 0, width, height);
    this.camera.setBackgroundColor('#0d0e13');
    this.camera.centerOn(this.layout.center.x, this.layout.center.y);
    this.camera.setRotation(this.getVisualRotation());
    this.camera.setZoom(this.getResponsiveZoom());
  }

  setLocalPlayerIndex(localPlayerIndex) {
    this.localPlayerIndex = localPlayerIndex;
    this.resize(this.viewport.width, this.viewport.height);
  }

  getVisualRotation() {
    const side = PLAYER_SIDE_BY_INDEX[this.localPlayerIndex] ?? 'left';
    const perspectiveRotation = CAMERA_ROTATION_BY_SIDE[side] ?? 0;

    if (this.isPortrait() && Math.abs(Math.cos(perspectiveRotation)) > 0.01) {
      return perspectiveRotation + Math.PI / 2;
    }

    return perspectiveRotation;
  }

  getResponsiveZoom() {
    const table = this.layout.table;
    const rotation = this.getVisualRotation();
    const rotatedQuarterTurn = Math.abs(Math.sin(rotation)) > 0.5;
    const visualWidth = rotatedQuarterTurn ? table.height : table.width;
    const visualHeight = rotatedQuarterTurn ? table.width : table.height;
    const margin = Math.min(this.viewport.width, this.viewport.height) * BOARD.marginRatio;
    const availableWidth = Math.max(this.viewport.width - margin * 2, 1);
    const availableHeight = Math.max(this.viewport.height - margin * 2, 1);

    return Math.min(availableWidth / visualWidth, availableHeight / visualHeight);
  }

  isPortrait() {
    return this.viewport.height > this.viewport.width;
  }

  screenToWorld(screenX, screenY) {
    return this.camera.getWorldPoint(screenX, screenY);
  }
}
